"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { costosParaValidacion } from "@/lib/stock-almacen";
import { solicitudTrasladoSchema, type SolicitudTrasladoInput } from "@/lib/validations/solicitud-traslado";

export type SolicitudTrasladoActionState = { error?: string; id?: string; numero?: string } | undefined;

export async function crearSolicitudTrasladoAction(data: SolicitudTrasladoInput): Promise<SolicitudTrasladoActionState> {
  const parsed = solicitudTrasladoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { almacenOrigenId, almacenDestinoId, fecha, observaciones, items } = parsed.data;

  try {
    const [usuario, almacenOrigen, almacenDestino] = await Promise.all([
      getUsuarioActual(),
      prisma.almacen.findUnique({ where: { id: almacenOrigenId } }),
      prisma.almacen.findUnique({ where: { id: almacenDestinoId } }),
    ]);
    if (!almacenOrigen || !almacenDestino) {
      return { error: "Uno de los almacenes seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
    }

    // Solo un sanity-check al momento de pedir (no reserva stock, igual que
    // Solped no reserva presupuesto): si para cuando se ejecute el traslado
    // ya no alcanza, crearTrasladoDesdeSolicitudAction lo vuelve a validar.
    const cantidadPorSku = new Map<string, number>();
    for (const item of items) {
      cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
    }
    const costosOrigen = await costosParaValidacion(almacenOrigenId);
    for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
      const disponible = costosOrigen.get(skuId)?.cantidad ?? 0;
      if (cantidadSolicitada > disponible) {
        const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
        return {
          error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacenOrigen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
        };
      }
    }

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const existentes = await tx.solicitudTraslado.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((s) => s.numero), "ST-", 9);

      const solicitud = await tx.solicitudTraslado.create({
        data: {
          numero,
          almacenOrigenId,
          almacenDestinoId,
          fecha,
          observaciones: observaciones || null,
          solicitanteId: usuario?.id,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of items) {
        await tx.solicitudTrasladoItem.create({
          data: {
            solicitudTrasladoId: solicitud.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
          },
        });
      }

      return solicitud;
    });

    revalidatePath("/logistica/solicitudes-traslado");
    revalidatePath("/logistica/almacenes");
    return { id: nuevaSolicitud.id, numero: nuevaSolicitud.numero };
  } catch (e) {
    console.error("Error inesperado en crearSolicitudTrasladoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la solicitud." };
  }
}

// No necesita verificar ningún estado (no hay aprobación): solo que ningún
// traslado ya haya ejecutado alguna de sus líneas. A diferencia de Solped
// (que, aprobada, se queda bloqueada en vez de borrarse), aquí siempre es
// borrado real: una solicitud de traslado nunca llega a un estado "final"
// protegido, solo pendiente/parcial/ejecutada.
export async function eliminarSolicitudTrasladoAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const solicitud = await prisma.solicitudTraslado.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };

    const itemsMovidos = await prisma.trasladoAlmacenItem.count({
      where: { solicitudTrasladoItem: { solicitudTrasladoId: id } },
    });
    if (itemsMovidos > 0) {
      return { error: "No se puede eliminar: ya hay un traslado que ejecutó productos de esta solicitud." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitudTrasladoItem.deleteMany({ where: { solicitudTrasladoId: id } });
      await tx.solicitudTraslado.delete({ where: { id } });
    });

    revalidatePath("/logistica/solicitudes-traslado");
    revalidatePath("/logistica/almacenes");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarSolicitudTrasladoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la solicitud." };
  }
}
