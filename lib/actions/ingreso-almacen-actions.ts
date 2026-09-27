"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero, prorratear } from "@/lib/utils";
import { convertirAUsd } from "@/lib/constants/moneda";
import { ingresoAlmacenSchema, type IngresoAlmacenInput } from "@/lib/validations/almacen";

export type IngresoAlmacenActionState = { error?: string; id?: string } | undefined;

export async function crearIngresoAlmacenAction(data: IngresoAlmacenInput): Promise<IngresoAlmacenActionState> {
  const parsed = ingresoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    fecha,
    ocNumero,
    moneda,
    guiaRemision,
    remitenteRuc,
    remitente,
    flete,
    proveedorId,
    almacenId,
    observaciones,
    items,
  } = parsed.data;

  const almacen = await prisma.almacen.findUnique({ where: { id: almacenId } });
  if (!almacen) {
    return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  // El flete se prorratea entre los items según su participación en el
  // subtotal (cantidad x precio unitario) del ingreso, ambos en la moneda
  // del documento. El costeo del stock (mapaCostosAlmacen) usa el
  // equivalente en Dólares de cada uno, para que un mismo producto no
  // mezcle Soles y Dólares entre ingresos distintos (ver convertirAUsd).
  const subtotales = items.map((item) => item.cantidad * item.precioUnitario);
  const fletePorItem = prorratear(flete, subtotales);
  const subtotalesUsd = subtotales.map((s) => convertirAUsd(s, moneda));
  const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

  try {
    const usuario = await getUsuarioActual();

    const nuevoIngreso = await prisma.$transaction(async (tx) => {
      const existentes = await tx.ingresoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((i) => i.numero), "IA-");

      const ingreso = await tx.ingresoAlmacen.create({
        data: {
          numero,
          fecha,
          ocNumero: ocNumero || null,
          moneda,
          guiaRemision: guiaRemision || null,
          remitenteRuc: remitenteRuc || null,
          remitente: remitente || null,
          flete: flete || null,
          proveedorId: proveedorId || null,
          almacenId,
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const subtotal = subtotales[i];
        const fleteAsignado = fletePorItem[i];
        const subtotalUsd = subtotalesUsd[i];
        const fleteAsignadoUsd = fletePorItemUsd[i];

        await tx.ingresoAlmacenItem.create({
          data: {
            ingresoAlmacenId: ingreso.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitario: item.precioUnitario,
            subtotal,
            precioUnitarioUsd: subtotalUsd / item.cantidad,
            subtotalUsd,
            fleteAsignado,
            fleteAsignadoUsd,
            lote: item.lote || null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenDestinoId: almacenId,
            tipo: "INGRESO",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "INGRESO_ALMACEN",
            documentoOrigenId: ingreso.id,
            fecha,
            creadoPorId: usuario?.id,
          },
        });
      }

      return ingreso;
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/ingresos");
    return { id: nuevoIngreso.id };
  } catch (e) {
    console.error("Error inesperado en crearIngresoAlmacenAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el ingreso." };
  }
}
