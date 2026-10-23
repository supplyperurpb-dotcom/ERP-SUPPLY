"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { costosParaValidacion } from "@/lib/stock-almacen";
import { solicitudDespachoSchema, type SolicitudDespachoInput } from "@/lib/validations/solicitud-despacho";

export type SolicitudDespachoActionState = { error?: string; id?: string; numero?: string } | undefined;

// No necesita aprobación: queda lista para atenderse apenas se crea, igual
// que la antigua Solicitud de Traslado. Solo un sanity-check de stock al
// momento de pedir (no reserva nada) — si para cuando Almacén la atienda
// (vía Consumo, ver crearConsumoAlmacenAction) ya no alcanza, se revalida
// ahí otra vez.
export async function crearSolicitudDespachoAction(data: SolicitudDespachoInput): Promise<SolicitudDespachoActionState> {
  const parsed = solicitudDespachoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { almacenId, fecha, observaciones, items } = parsed.data;

  try {
    const [usuario, almacen] = await Promise.all([getUsuarioActual(), prisma.almacen.findUnique({ where: { id: almacenId } })]);
    if (!almacen) {
      return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
    }

    const cantidadPorSku = new Map<string, number>();
    for (const item of items) {
      cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
    }
    const costos = await costosParaValidacion(almacenId);
    for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
      const disponible = costos.get(skuId)?.cantidad ?? 0;
      if (cantidadSolicitada > disponible) {
        const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
        return {
          error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
        };
      }
    }

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const existentes = await tx.solicitudDespacho.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((s) => s.numero), "SD-");

      const solicitud = await tx.solicitudDespacho.create({
        data: {
          numero,
          almacenId,
          fecha,
          observaciones: observaciones || null,
          solicitanteId: usuario?.id,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of items) {
        await tx.solicitudDespachoItem.create({
          data: {
            solicitudDespachoId: solicitud.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
          },
        });
      }

      return solicitud;
    });

    revalidatePath("/logistica/solicitudes-despacho");
    revalidatePath("/logistica/almacenes");
    return { id: nuevaSolicitud.id, numero: nuevaSolicitud.numero };
  } catch (e) {
    console.error("Error inesperado en crearSolicitudDespachoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la solicitud." };
  }
}

// Igual que la antigua Solicitud de Traslado: no hay estado de aprobación
// que proteja el borrado, solo que ningún consumo ya haya atendido alguna
// de sus líneas.
export async function eliminarSolicitudDespachoAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const solicitud = await prisma.solicitudDespacho.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };

    const itemsAtendidos = await prisma.consumoAlmacenItem.count({
      where: { solicitudDespachoItem: { solicitudDespachoId: id } },
    });
    if (itemsAtendidos > 0) {
      return { error: "No se puede eliminar: ya hay un consumo que atendió productos de esta solicitud." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitudDespachoItem.deleteMany({ where: { solicitudDespachoId: id } });
      await tx.solicitudDespacho.delete({ where: { id } });
    });

    revalidatePath("/logistica/solicitudes-despacho");
    revalidatePath("/logistica/almacenes");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarSolicitudDespachoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la solicitud." };
  }
}
