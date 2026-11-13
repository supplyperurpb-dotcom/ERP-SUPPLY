"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { stockDisponible, precioUnitarioPonderadoAFecha } from "@/lib/stock-almacen";
import { categoriaAlmacenExigidaPorSku, ETIQUETA_CATEGORIA_ALMACEN } from "@/lib/constants/sku";
import { devolucionAlmacenSchema, type DevolucionAlmacenInput } from "@/lib/validations/devolucion-almacen";
import type { Prisma } from "@prisma/client";

export type DevolucionAlmacenActionState = { error?: string; id?: string; numero?: string } | undefined;

type Tx = Prisma.TransactionClient;

// Solo para mostrarle al usuario una vista previa del precio mientras arma
// la devolución (ver devolucion-almacen-form.tsx) — el precio real que se
// guarda siempre se recalcula en el servidor al enviar el formulario (ver
// validarOrigen), nunca se confía en este valor. Se pide con la misma
// `fecha` que se va a guardar: el ponderado tal como era ESE día, no el de
// hoy (ver precioUnitarioPonderadoAFecha).
export async function obtenerPrecioPonderadoAction(almacenId: string, skuId: string, fecha: Date): Promise<number | null> {
  if (!almacenId || !skuId) return null;
  return precioUnitarioPonderadoAFecha(almacenId, skuId, fecha);
}

type ItemConPrecio = DevolucionAlmacenInput["items"][number] & { precioUnitario: number; subtotal: number };

// Valida el almacén (general, activo si corresponde) y el proveedor (si se
// indicó uno), y calcula en el servidor el precio de cada línea — nunca
// se confía en lo que mande el cliente: 0 si noValorado, si no el costo
// unitario ponderado ACTUAL del SKU en el almacén de destino (ver
// precioUnitarioPonderado en lib/stock-almacen.ts). También exige que cada
// código solo entre al almacén de la categoría que le corresponde (ver
// categoriaAlmacenExigidaPorSku) y, en almacenes de Pesticidas/Fertilizantes
// (o si el propio SKU lo exige), lote + fechas de producción/vencimiento.
async function validarOrigen(tx: Tx, data: DevolucionAlmacenInput, exigirActivo: boolean) {
  const almacen = await tx.almacen.findUnique({ where: { id: data.almacenId } });
  if (!almacen) throw new Error("El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo.");
  if (exigirActivo && !almacen.activo) {
    throw new Error(`${almacen.nombre} está inactivo. Actívalo antes de registrar devoluciones ahí.`);
  }
  if (!almacen.esGeneral) {
    throw new Error("Las devoluciones solo se registran en un almacén general; este es un sub-almacén.");
  }

  if (data.proveedorId) {
    const proveedor = await tx.proveedor.findUnique({ where: { id: data.proveedorId } });
    if (!proveedor) throw new Error("El proveedor seleccionado ya no existe. Actualiza la página e intenta de nuevo.");
  }

  const skuIds = [...new Set(data.items.map((i) => i.skuId))];
  const skus = await tx.sku.findMany({ where: { id: { in: skuIds } } });
  const skuPorId = new Map(skus.map((s) => [s.id, s]));

  const itemsConPrecio: ItemConPrecio[] = [];
  for (const item of data.items) {
    const sku = skuPorId.get(item.skuId);
    if (!sku) throw new Error("Uno de los productos ya no existe. Actualiza la página e intenta de nuevo.");

    const categoriaExigida = categoriaAlmacenExigidaPorSku(sku);
    if (categoriaExigida && almacen.categoriaGeneral !== categoriaExigida) {
      throw new Error(
        `${sku.codigo} solo se puede devolver a un almacén de categoría ${ETIQUETA_CATEGORIA_ALMACEN[categoriaExigida]} (${almacen.nombre} no lo es).`
      );
    }

    if (almacen.categoriaGeneral === "PESTICIDAS" || almacen.categoriaGeneral === "FERTILIZANTES" || sku.requiereLote) {
      if (!item.lote?.trim()) throw new Error(`Al código ${sku.codigo} no se le ha registrado Lote.`);
      if (!item.fechaProduccion) throw new Error(`Al código ${sku.codigo} no se le ha registrado Fecha de Producción.`);
      if (!item.fechaVencimiento) throw new Error(`Al código ${sku.codigo} no se le ha registrado Fecha de Vencimiento.`);
    }

    let precioUnitario = 0;
    if (!item.noValorado) {
      // El ponderado tal como era en la fecha de la devolución (no el de
      // hoy) — ver precioUnitarioPonderadoAFecha en lib/stock-almacen.ts.
      const precio = await precioUnitarioPonderadoAFecha(data.almacenId, item.skuId, data.fecha, tx);
      if (precio === null) {
        throw new Error(
          `No hay costo ponderado calculable de ${sku.codigo} en ${almacen.nombre} hasta la fecha de esta devolución (nunca ingresó ahí). Marca "No valorado" para esta línea o corrige el almacén.`
        );
      }
      precioUnitario = precio;
    }

    itemsConPrecio.push({ ...item, precioUnitario, subtotal: precioUnitario * item.cantidad });
  }

  return { almacen, itemsConPrecio };
}

export async function crearDevolucionAlmacenAction(data: DevolucionAlmacenInput): Promise<DevolucionAlmacenActionState> {
  const parsed = devolucionAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, almacenId, area, personaQueTrae, personaQueTraeDni, proveedorId, observaciones } = parsed.data;

  try {
    const usuario = await getUsuarioActual();

    const nuevaDevolucion = await prisma.$transaction(async (tx) => {
      const { itemsConPrecio } = await validarOrigen(tx, parsed.data, true);

      const existentes = await tx.devolucionAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((d) => d.numero), "DA-");

      const devolucion = await tx.devolucionAlmacen.create({
        data: {
          numero,
          fecha,
          almacenId,
          area,
          personaQueTrae,
          personaQueTraeDni,
          proveedorId: proveedorId || null,
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of itemsConPrecio) {
        await tx.devolucionAlmacenItem.create({
          data: {
            devolucionAlmacenId: devolucion.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            noValorado: item.noValorado,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            lote: item.lote || null,
            fechaProduccion: item.fechaProduccion ?? null,
            fechaVencimiento: item.fechaVencimiento ?? null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenDestinoId: almacenId,
            tipo: "INGRESO",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "DEVOLUCION_ALMACEN",
            documentoOrigenId: devolucion.id,
            fecha,
            creadoPorId: usuario?.id,
          },
        });
      }

      return devolucion;
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/devoluciones");
    return { id: nuevaDevolucion.id, numero: nuevaDevolucion.numero };
  } catch (e) {
    console.error("Error inesperado en crearDevolucionAlmacenAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la devolución." };
  }
}

export async function actualizarDevolucionAlmacenAction(
  id: string,
  data: DevolucionAlmacenInput
): Promise<DevolucionAlmacenActionState> {
  const parsed = devolucionAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, almacenId, area, personaQueTrae, personaQueTraeDni, proveedorId, observaciones } = parsed.data;

  const existente = await prisma.devolucionAlmacen.findUnique({ where: { id }, include: { items: true } });
  if (!existente) return { error: "La devolución ya no existe." };

  // Antes de tocar nada: ¿el almacén todavía tiene, de cada producto, al
  // menos lo que esta devolución trajo? Si no, parte de ese stock ya se
  // trasladó o se consumió y no se puede reversar sin dejarlo en negativo.
  for (const item of existente.items) {
    const disponible = await stockDisponible(existente.almacenId, item.skuId);
    if (disponible < Number(item.cantidad)) {
      const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
      return {
        error: `No se puede editar: parte de lo que trajo esta devolución (${sku?.codigo ?? item.skuId}) ya se trasladó o se consumió del almacén.`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Se borran las líneas viejas ANTES de revalidar, dentro de la misma
      // transacción, para que el costo ponderado se recalcule sin ellas
      // (igual criterio que actualizarIngresoAlmacenAction).
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "DEVOLUCION_ALMACEN" } });
      await tx.devolucionAlmacenItem.deleteMany({ where: { devolucionAlmacenId: id } });

      const { itemsConPrecio } = await validarOrigen(tx, parsed.data, false);
      const usuario = await getUsuarioActual();

      await tx.devolucionAlmacen.update({
        where: { id },
        data: {
          fecha,
          almacenId,
          area,
          personaQueTrae,
          personaQueTraeDni,
          proveedorId: proveedorId || null,
          observaciones: observaciones || null,
        },
      });

      for (const item of itemsConPrecio) {
        await tx.devolucionAlmacenItem.create({
          data: {
            devolucionAlmacenId: id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            noValorado: item.noValorado,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            lote: item.lote || null,
            fechaProduccion: item.fechaProduccion ?? null,
            fechaVencimiento: item.fechaVencimiento ?? null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenDestinoId: almacenId,
            tipo: "INGRESO",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "DEVOLUCION_ALMACEN",
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
    revalidatePath("/logistica/almacenes/devoluciones");
    revalidatePath(`/logistica/almacenes/devoluciones/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarDevolucionAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar la devolución." };
  }
}

export async function eliminarDevolucionAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const devolucion = await prisma.devolucionAlmacen.findUnique({ where: { id }, include: { items: true } });
    if (!devolucion) return { error: "La devolución ya no existe." };

    for (const item of devolucion.items) {
      const disponible = await stockDisponible(devolucion.almacenId, item.skuId);
      if (disponible < Number(item.cantidad)) {
        const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
        return {
          error: `No se puede eliminar: parte de lo que trajo esta devolución (${sku?.codigo ?? item.skuId}) ya se trasladó o se consumió del almacén.`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "DEVOLUCION_ALMACEN" } });
      await tx.devolucionAlmacenItem.deleteMany({ where: { devolucionAlmacenId: id } });
      await tx.devolucionAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${devolucion.almacenId}`);
    revalidatePath("/logistica/almacenes/devoluciones");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarDevolucionAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la devolución." };
  }
}
