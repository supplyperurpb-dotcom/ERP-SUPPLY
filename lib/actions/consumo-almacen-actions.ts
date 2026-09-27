"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { costosParaValidacion } from "@/lib/stock-almacen";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";

export type ConsumoAlmacenActionState = { error?: string; id?: string } | undefined;

export async function crearConsumoAlmacenAction(data: ConsumoAlmacenInput): Promise<ConsumoAlmacenActionState> {
  const parsed = consumoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, almacenOrigenId, observaciones, items } = parsed.data;

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
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of items) {
        const precioUnitarioPonderadoValor = precioPorSku.get(item.skuId)!;
        const valorConsumido = item.cantidad * precioUnitarioPonderadoValor;

        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: consumo.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: precioUnitarioPonderadoValor,
            valorConsumido,
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

export async function actualizarConsumoAlmacenAction(
  id: string,
  data: ConsumoAlmacenInput
): Promise<ConsumoAlmacenActionState> {
  const parsed = consumoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, almacenOrigenId, observaciones, items } = parsed.data;

  const almacen = await prisma.almacen.findUnique({ where: { id: almacenOrigenId } });
  if (!almacen) {
    return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const cantidadPorSku = new Map<string, number>();
  for (const item of items) {
    cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
  }

  try {
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      const existente = await tx.consumoAlmacen.findUnique({ where: { id } });
      if (!existente) throw new Error("El consumo ya no existe. Actualiza la página e intenta de nuevo.");

      // Se borran primero los efectos viejos (movimientos e items) para que
      // la validación de abajo, hecha con el mismo `tx`, "vea" el mundo sin
      // este consumo — así se detecta si alguna cantidad nueva ya no cabe
      // porque, mientras tanto, otro movimiento usó ese stock.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "CONSUMO_ALMACEN" } });
      await tx.consumoAlmacenItem.deleteMany({ where: { consumoAlmacenId: id } });

      const costosOrigen = await costosParaValidacion(almacenOrigenId, tx);
      const precioPorSku = new Map<string, number>();
      for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
        const costo = costosOrigen.get(skuId);
        const disponible = costo?.cantidad ?? 0;
        if (cantidadSolicitada > disponible) {
          const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
          throw new Error(
            `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`
          );
        }
        if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
          const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
          throw new Error(
            `No hay ingresos ni traslados con costo registrados de ${sku?.codigo ?? skuId} en ${almacen.nombre}, así que no se puede calcular su precio unitario ponderado.`
          );
        }
        precioPorSku.set(skuId, costo.precioUnitarioPonderado);
      }

      await tx.consumoAlmacen.update({
        where: { id },
        data: { fecha, almacenOrigenId, observaciones: observaciones || null },
      });

      for (const item of items) {
        const precioUnitarioPonderadoValor = precioPorSku.get(item.skuId)!;
        const valorConsumido = item.cantidad * precioUnitarioPonderadoValor;

        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: precioUnitarioPonderadoValor,
            valorConsumido,
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
            documentoOrigenId: id,
            fecha,
            observaciones: observaciones || null,
            creadoPorId: usuario?.id,
          },
        });
      }
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenOrigenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    revalidatePath(`/logistica/almacenes/consumos/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar el consumo." };
  }
}

export async function eliminarConsumoAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const consumo = await prisma.consumoAlmacen.findUnique({ where: { id } });
    if (!consumo) return { error: "El consumo ya no existe." };

    await prisma.$transaction(async (tx) => {
      // Reversar un consumo siempre es seguro: le devuelve stock al
      // almacén, nunca puede dejarlo en negativo.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "CONSUMO_ALMACEN" } });
      await tx.consumoAlmacenItem.deleteMany({ where: { consumoAlmacenId: id } });
      await tx.consumoAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${consumo.almacenOrigenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el consumo." };
  }
}
