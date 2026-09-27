"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero, prorratear } from "@/lib/utils";
import { costosParaValidacion } from "@/lib/stock-almacen";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";

export type ConsumoAlmacenActionState = { error?: string; id?: string } | undefined;

export async function crearConsumoAlmacenAction(data: ConsumoAlmacenInput): Promise<ConsumoAlmacenActionState> {
  const parsed = consumoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, almacenOrigenId, guiaRemision, remitenteRuc, remitente, flete, observaciones, items } = parsed.data;

  const almacen = await prisma.almacen.findUnique({ where: { id: almacenOrigenId } });
  if (!almacen) {
    return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const cantidadPorSku = new Map<string, number>();
  for (const item of items) {
    cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
  }

  const costosOrigen = await costosParaValidacion(almacenOrigenId);
  const precioPorSku = new Map<string, number>();
  for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
    const costo = costosOrigen.get(skuId);
    const disponible = costo?.cantidad ?? 0;
    if (cantidadSolicitada > disponible) {
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
      return {
        error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
      };
    }
    if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
      return {
        error: `No hay ingresos ni traslados con costo registrados de ${sku?.codigo ?? skuId} en ${almacen.nombre}, así que no se puede calcular su precio unitario ponderado.`,
      };
    }
    precioPorSku.set(skuId, costo.precioUnitarioPonderado);
  }

  // El flete se prorratea entre los items según su participación en el
  // valor consumido (cantidad x precio unitario ponderado). Este flete es
  // solo informativo del consumo: no afecta el costeo del stock restante
  // (ver comentario en ConsumoAlmacenItem.fleteAsignado).
  const valoresConsumidos = items.map((item) => item.cantidad * precioPorSku.get(item.skuId)!);
  const fletePorItem = prorratear(flete, valoresConsumidos);

  try {
    const usuario = await getUsuarioActual();

    const nuevoConsumo = await prisma.$transaction(async (tx) => {
      const existentes = await tx.consumoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((c) => c.numero), "CA-");

      const consumo = await tx.consumoAlmacen.create({
        data: {
          numero,
          fecha,
          almacenOrigenId,
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
        const precioUnitarioPonderadoValor = precioPorSku.get(item.skuId)!;

        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: consumo.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: precioUnitarioPonderadoValor,
            valorConsumido: valoresConsumidos[i],
            fleteAsignado: fletePorItem[i],
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenOrigenId,
            tipo: "SALIDA",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "CONSUMO_ALMACEN",
            documentoOrigenId: consumo.id,
            fecha,
            observaciones: observaciones || null,
            creadoPorId: usuario?.id,
          },
        });
      }

      return consumo;
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenOrigenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    return { id: nuevoConsumo.id };
  } catch (e) {
    console.error("Error inesperado en crearConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el consumo." };
  }
}
