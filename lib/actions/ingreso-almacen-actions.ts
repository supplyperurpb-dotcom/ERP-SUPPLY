"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero, prorratear } from "@/lib/utils";
import { convertirAUsd } from "@/lib/constants/moneda";
import { stockDisponible } from "@/lib/stock-almacen";
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

export async function actualizarIngresoAlmacenAction(
  id: string,
  data: IngresoAlmacenInput
): Promise<IngresoAlmacenActionState> {
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

  const existente = await prisma.ingresoAlmacen.findUnique({ where: { id }, include: { items: true } });
  if (!existente) return { error: "El ingreso ya no existe." };

  // Antes de tocar nada: ¿el almacén todavía tiene, de cada producto, al
  // menos lo que este ingreso trajo? Si no, parte de ese stock ya se
  // trasladó o se consumió y no se puede reversar sin dejarlo en negativo.
  for (const item of existente.items) {
    const disponible = await stockDisponible(existente.almacenId, item.skuId);
    if (disponible < Number(item.cantidad)) {
      const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
      return {
        error: `No se puede editar: parte de lo que trajo este ingreso (${sku?.codigo ?? item.skuId}) ya se trasladó o se consumió del almacén.`,
      };
    }
  }

  const almacen = await prisma.almacen.findUnique({ where: { id: almacenId } });
  if (!almacen) {
    return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const subtotales = items.map((item) => item.cantidad * item.precioUnitario);
  const fletePorItem = prorratear(flete, subtotales);
  const subtotalesUsd = subtotales.map((s) => convertirAUsd(s, moneda));
  const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

  try {
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "INGRESO_ALMACEN" } });
      await tx.ingresoAlmacenItem.deleteMany({ where: { ingresoAlmacenId: id } });

      await tx.ingresoAlmacen.update({
        where: { id },
        data: {
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
            ingresoAlmacenId: id,
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
            documentoOrigenId: id,
            fecha,
            creadoPorId: usuario?.id,
          },
        });
      }
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${existente.almacenId}`);
    revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/ingresos");
    revalidatePath(`/logistica/almacenes/ingresos/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarIngresoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar el ingreso." };
  }
}

export async function eliminarIngresoAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const ingreso = await prisma.ingresoAlmacen.findUnique({ where: { id }, include: { items: true } });
    if (!ingreso) return { error: "El ingreso ya no existe." };

    for (const item of ingreso.items) {
      const disponible = await stockDisponible(ingreso.almacenId, item.skuId);
      if (disponible < Number(item.cantidad)) {
        const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
        return {
          error: `No se puede eliminar: parte de lo que trajo este ingreso (${sku?.codigo ?? item.skuId}) ya se trasladó o se consumió del almacén.`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "INGRESO_ALMACEN" } });
      await tx.ingresoAlmacenItem.deleteMany({ where: { ingresoAlmacenId: id } });
      await tx.ingresoAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${ingreso.almacenId}`);
    revalidatePath("/logistica/almacenes/ingresos");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarIngresoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el ingreso." };
  }
}
