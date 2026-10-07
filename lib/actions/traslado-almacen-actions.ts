"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero, prorratear } from "@/lib/utils";
import { convertirAUsd } from "@/lib/constants/moneda";
import { costosParaValidacion, stockDisponible, cantidadPendienteTrasladoItem } from "@/lib/stock-almacen";
import {
  trasladoAlmacenSchema,
  trasladoDesdeSolicitudSchema,
  type TrasladoAlmacenInput,
  type TrasladoDesdeSolicitudInput,
} from "@/lib/validations/almacen";
import type { Prisma } from "@prisma/client";

export type TrasladoAlmacenActionState = { error?: string; id?: string } | undefined;

type Tx = Prisma.TransactionClient;

export async function crearTrasladoAlmacenAction(data: TrasladoAlmacenInput): Promise<TrasladoAlmacenActionState> {
  const parsed = trasladoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    fecha,
    almacenOrigenId,
    almacenDestinoId,
    moneda,
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
  // valor total (cantidad x costo unitario del origen, en USD) del
  // traslado. El flete mismo puede registrarse en Soles o Dólares (moneda
  // del traslado); su equivalente en Dólares es lo que usa el costeo del
  // almacén de destino (ver mapaCostosAlmacen).
  const valoresTotales = items.map((item) => item.cantidad * costoUnitarioPorSku.get(item.skuId)!);
  const fletePorItem = prorratear(flete, valoresTotales);
  const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

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
          moneda,
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
            fleteAsignadoUsd: fletePorItemUsd[i],
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

export async function actualizarTrasladoAlmacenAction(
  id: string,
  data: TrasladoAlmacenInput
): Promise<TrasladoAlmacenActionState> {
  const parsed = trasladoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    fecha,
    almacenOrigenId,
    almacenDestinoId,
    moneda,
    guiaRemision,
    remitenteRuc,
    remitente,
    flete,
    observaciones,
    items,
  } = parsed.data;

  const existente = await prisma.trasladoAlmacen.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existente) return { error: "El traslado ya no existe." };

  // Antes de tocar nada: ¿el destino todavía tiene, de cada producto, al
  // menos lo que este traslado le trajo? Si no, parte de ese stock ya se
  // movió o se consumió desde entonces y no se puede reversar sin dejar el
  // destino en negativo.
  for (const item of existente.items) {
    const disponibleDestino = await stockDisponible(existente.almacenDestinoId, item.skuId);
    if (disponibleDestino < Number(item.cantidad)) {
      const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
      return {
        error: `No se puede editar: parte de lo que trajo este traslado (${sku?.codigo ?? item.skuId}) ya se movió o se consumió del almacén de destino.`,
      };
    }
  }

  const [almacenOrigen, almacenDestino] = await Promise.all([
    prisma.almacen.findUnique({ where: { id: almacenOrigenId } }),
    prisma.almacen.findUnique({ where: { id: almacenDestinoId } }),
  ]);
  if (!almacenOrigen || !almacenDestino) {
    return { error: "Uno de los almacenes seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const cantidadPorSku = new Map<string, number>();
  for (const item of items) {
    cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
  }

  try {
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      // Se borran primero los efectos viejos para que la validación de
      // abajo (con el mismo `tx`) vea el mundo sin este traslado.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "TRASLADO_ALMACEN" } });
      await tx.trasladoAlmacenItem.deleteMany({ where: { trasladoAlmacenId: id } });

      const costosOrigen = await costosParaValidacion(almacenOrigenId, tx);
      const costoUnitarioPorSku = new Map<string, number>();
      for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
        const costo = costosOrigen.get(skuId);
        const disponible = costo?.cantidad ?? 0;
        if (cantidadSolicitada > disponible) {
          const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
          throw new Error(
            `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacenOrigen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`
          );
        }
        if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
          const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
          throw new Error(`No se pudo determinar el costo unitario ponderado de ${sku?.codigo ?? skuId} en ${almacenOrigen.nombre}.`);
        }
        costoUnitarioPorSku.set(skuId, costo.precioUnitarioPonderado);
      }

      const valoresTotales = items.map((item) => item.cantidad * costoUnitarioPorSku.get(item.skuId)!);
      const fletePorItem = prorratear(flete, valoresTotales);
      const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

      await tx.trasladoAlmacen.update({
        where: { id },
        data: {
          fecha,
          almacenOrigenId,
          almacenDestinoId,
          moneda,
          guiaRemision: guiaRemision || null,
          remitenteRuc: remitenteRuc || null,
          remitente: remitente || null,
          flete: flete || null,
          observaciones: observaciones || null,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const costoUnitario = costoUnitarioPorSku.get(item.skuId)!;
        await tx.trasladoAlmacenItem.create({
          data: {
            trasladoAlmacenId: id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            costoUnitario,
            valorTotal: valoresTotales[i],
            fleteAsignado: fletePorItem[i],
            fleteAsignadoUsd: fletePorItemUsd[i],
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
            documentoOrigenId: id,
            fecha,
            observaciones: observaciones || null,
            creadoPorId: usuario?.id,
          },
        });
      }
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${existente.almacenOrigenId}`);
    revalidatePath(`/logistica/almacenes/${existente.almacenDestinoId}`);
    revalidatePath(`/logistica/almacenes/${almacenOrigenId}`);
    revalidatePath(`/logistica/almacenes/${almacenDestinoId}`);
    revalidatePath("/logistica/almacenes/traslados");
    revalidatePath(`/logistica/almacenes/traslados/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarTrasladoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar el traslado." };
  }
}

// Ejecuta (total o parcialmente) una Solicitud de Traslado ya existente: a
// diferencia de crearTrasladoAlmacenAction (libre, sin solicitud), aquí el
// almacén origen y destino NO llegan del cliente — se leen de la solicitud
// misma, igual que crearIngresoAlmacenAction nunca confía en el proveedor
// que mande el cliente y lo vuelve a leer de la OC.
async function validarSolicitud(tx: Tx, data: TrasladoDesdeSolicitudInput) {
  const solicitud = await tx.solicitudTraslado.findUnique({
    where: { id: data.solicitudTrasladoId },
    include: { almacenOrigen: true, almacenDestino: true },
  });
  if (!solicitud) {
    throw new Error("La solicitud de traslado seleccionada ya no existe. Actualiza la página e intenta de nuevo.");
  }

  const itemsSolicitud = await tx.solicitudTrasladoItem.findMany({
    where: { solicitudTrasladoId: solicitud.id },
    include: { sku: true },
  });
  const itemPorId = new Map(itemsSolicitud.map((i) => [i.id, i]));

  for (const item of data.items) {
    const itemSolicitud = itemPorId.get(item.solicitudTrasladoItemId);
    if (!itemSolicitud) {
      throw new Error("Uno de los productos no pertenece a la solicitud de traslado seleccionada.");
    }
    const pendiente = await cantidadPendienteTrasladoItem(item.solicitudTrasladoItemId, tx);
    if (item.cantidad > pendiente) {
      throw new Error(
        `La cantidad de ${itemSolicitud.sku.codigo} supera lo pendiente de la solicitud (disponible: ${pendiente}, ingresado ahora: ${item.cantidad}). Actualiza la página e intenta de nuevo.`
      );
    }
  }

  return { solicitud, itemPorId };
}

export async function crearTrasladoDesdeSolicitudAction(
  data: TrasladoDesdeSolicitudInput
): Promise<TrasladoAlmacenActionState> {
  const parsed = trasladoDesdeSolicitudSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, moneda, guiaRemision, remitenteRuc, remitente, flete, observaciones, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();

    const nuevoTraslado = await prisma.$transaction(async (tx) => {
      const { solicitud, itemPorId } = await validarSolicitud(tx, parsed.data);
      const almacenOrigenId = solicitud.almacenOrigenId;
      const almacenDestinoId = solicitud.almacenDestinoId;

      const costosOrigen = await costosParaValidacion(almacenOrigenId, tx);
      const costoUnitarioPorSku = new Map<string, number>();
      for (const item of items) {
        const itemSolicitud = itemPorId.get(item.solicitudTrasladoItemId)!;
        const costo = costosOrigen.get(itemSolicitud.skuId);
        if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
          throw new Error(
            `No se pudo determinar el costo unitario ponderado de ${itemSolicitud.sku.codigo} en ${solicitud.almacenOrigen.nombre}.`
          );
        }
        costoUnitarioPorSku.set(item.solicitudTrasladoItemId, costo.precioUnitarioPonderado);
      }

      const valoresTotales = items.map((item) => item.cantidad * costoUnitarioPorSku.get(item.solicitudTrasladoItemId)!);
      const fletePorItem = prorratear(flete, valoresTotales);
      const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

      const existentes = await tx.trasladoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((t) => t.numero), "TA-");

      const traslado = await tx.trasladoAlmacen.create({
        data: {
          numero,
          fecha,
          almacenOrigenId,
          almacenDestinoId,
          solicitudTrasladoId: solicitud.id,
          moneda,
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
        const itemSolicitud = itemPorId.get(item.solicitudTrasladoItemId)!;
        const costoUnitario = costoUnitarioPorSku.get(item.solicitudTrasladoItemId)!;

        await tx.trasladoAlmacenItem.create({
          data: {
            trasladoAlmacenId: traslado.id,
            solicitudTrasladoItemId: item.solicitudTrasladoItemId,
            skuId: itemSolicitud.skuId,
            cantidad: item.cantidad,
            unidadMedida: itemSolicitud.unidadMedida,
            costoUnitario,
            valorTotal: valoresTotales[i],
            fleteAsignado: fletePorItem[i],
            fleteAsignadoUsd: fletePorItemUsd[i],
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: itemSolicitud.skuId,
            almacenOrigenId,
            almacenDestinoId,
            tipo: "TRANSFERENCIA",
            cantidad: item.cantidad,
            unidadMedida: itemSolicitud.unidadMedida,
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
    revalidatePath(`/logistica/almacenes/${nuevoTraslado.almacenOrigenId}`);
    revalidatePath(`/logistica/almacenes/${nuevoTraslado.almacenDestinoId}`);
    revalidatePath("/logistica/almacenes/traslados");
    revalidatePath("/logistica/solicitudes-traslado");
    revalidatePath(`/logistica/solicitudes-traslado/${nuevoTraslado.solicitudTrasladoId}`);
    return { id: nuevoTraslado.id };
  } catch (e) {
    console.error("Error inesperado en crearTrasladoDesdeSolicitudAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al guardar el traslado." };
  }
}

export async function eliminarTrasladoAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const traslado = await prisma.trasladoAlmacen.findUnique({ where: { id }, include: { items: true } });
    if (!traslado) return { error: "El traslado ya no existe." };

    for (const item of traslado.items) {
      const disponibleDestino = await stockDisponible(traslado.almacenDestinoId, item.skuId);
      if (disponibleDestino < Number(item.cantidad)) {
        const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
        return {
          error: `No se puede eliminar: parte de lo que trajo este traslado (${sku?.codigo ?? item.skuId}) ya se movió o se consumió del almacén de destino.`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "TRASLADO_ALMACEN" } });
      await tx.trasladoAlmacenItem.deleteMany({ where: { trasladoAlmacenId: id } });
      await tx.trasladoAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${traslado.almacenOrigenId}`);
    revalidatePath(`/logistica/almacenes/${traslado.almacenDestinoId}`);
    revalidatePath("/logistica/almacenes/traslados");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarTrasladoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el traslado." };
  }
}
