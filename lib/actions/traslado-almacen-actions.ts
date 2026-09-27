"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero, prorratear } from "@/lib/utils";
import { costosParaValidacion } from "@/lib/stock-almacen";
import { trasladoAlmacenSchema, type TrasladoAlmacenInput } from "@/lib/validations/almacen";

export type TrasladoAlmacenActionState = { error?: string; id?: string } | undefined;

export async function crearTrasladoAlmacenAction(data: TrasladoAlmacenInput): Promise<TrasladoAlmacenActionState> {
  const parsed = trasladoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    fecha,
    almacenOrigenId,
    almacenDestinoId,
    guiaRemision,
    remitenteRuc,
    remitente,
    flete,
    observaciones,
    items,
  } = parsed.data;

  const [almacenOrigen, almacenDestino] = await Promise.all([
    prisma.almacen.findUnique({ where: { id: almacenOrigenId } }),
    prisma.almacen.findUnique({ where: { id: almacenDestinoId } }),
  ]);
  if (!almacenOrigen || !almacenDestino) {
    return { error: "Uno de los almacenes seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
  }

  // Validar stock disponible en el almacén de origen para cada línea antes
  // de mover nada (si dos líneas repiten el mismo SKU, se valida la suma), y
  // de paso obtener el costo unitario ponderado del origen: el producto
  // "viaja" con ese costo hacia el almacén de destino.
  const cantidadPorSku = new Map<string, number>();
  for (const item of items) {
    cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
  }
  const costosOrigen = await costosParaValidacion(almacenOrigenId);
  const costoUnitarioPorSku = new Map<string, number>();
  for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
    const costo = costosOrigen.get(skuId);
    const disponible = costo?.cantidad ?? 0;
    if (cantidadSolicitada > disponible) {
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
      return {
        error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacenOrigen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
      };
    }
    if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
      return {
        error: `No se pudo determinar el costo unitario ponderado de ${sku?.codigo ?? skuId} en ${almacenOrigen.nombre}.`,
      };
    }
    costoUnitarioPorSku.set(skuId, costo.precioUnitarioPonderado);
  }

  // El flete se prorratea entre los items según su participación en el
  // valor total (cantidad x costo unitario del origen) del traslado.
  const valoresTotales = items.map((item) => item.cantidad * costoUnitarioPorSku.get(item.skuId)!);
  const fletePorItem = prorratear(flete, valoresTotales);

  try {
    const usuario = await getUsuarioActual();

    const nuevoTraslado = await prisma.$transaction(async (tx) => {
      const existentes = await tx.trasladoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((t) => t.numero), "TA-");

      const traslado = await tx.trasladoAlmacen.create({
        data: {
          numero,
          fecha,
          almacenOrigenId,
          almacenDestinoId,
          guiaRemision: guiaRemision || null,
          remitenteRuc: remitenteRuc || null,
          remitente: remitente || null,
          flete: flete || null,
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const costoUnitario = costoUnitarioPorSku.get(item.skuId)!;
        await tx.trasladoAlmacenItem.create({
          data: {
            trasladoAlmacenId: traslado.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            costoUnitario,
            valorTotal: valoresTotales[i],
            fleteAsignado: fletePorItem[i],
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenOrigenId,
            almacenDestinoId,
            tipo: "TRANSFERENCIA",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "TRASLADO_ALMACEN",
            documentoOrigenId: traslado.id,
            fecha,
            observaciones: observaciones || null,
            creadoPorId: usuario?.id,
          },
        });
      }

      return traslado;
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenOrigenId}`);
    revalidatePath(`/logistica/almacenes/${almacenDestinoId}`);
    revalidatePath("/logistica/almacenes/traslados");
    return { id: nuevoTraslado.id };
  } catch (e) {
    console.error("Error inesperado en crearTrasladoAlmacenAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el traslado." };
  }
}
