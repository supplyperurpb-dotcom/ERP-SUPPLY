"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { solicitudPedidoSchema, type SolicitudPedidoInput } from "@/lib/validations/compras";

export type SolicitudPedidoActionState = { error?: string; id?: string } | undefined;

export async function crearSolicitudPedidoAction(data: SolicitudPedidoInput): Promise<SolicitudPedidoActionState> {
  const parsed = solicitudPedidoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { area, fecha, fechaNecesidad, tipoNecesidad, justificacion, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const existentes = await tx.solicitudPedido.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((s) => s.numero), "SP-");

      const solicitud = await tx.solicitudPedido.create({
        data: {
          numero,
          area,
          fecha,
          fechaNecesidad,
          tipoNecesidad,
          justificacion: justificacion || null,
          solicitanteId: usuario?.id,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of items) {
        await tx.solicitudPedidoItem.create({
          data: {
            solicitudPedidoId: solicitud.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            centroCosto: item.centroCosto,
            observaciones: item.observaciones || null,
          },
        });
      }

      return solicitud;
    });

    revalidatePath("/logistica/solicitudes-pedido");
    return { id: nuevaSolicitud.id };
  } catch (e) {
    console.error("Error inesperado en crearSolicitudPedidoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la solicitud." };
  }
}

export async function eliminarSolicitudPedidoAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const itemsJalados = await prisma.ordenCompraItem.count({
      where: { solicitudPedidoItem: { solicitudPedidoId: id }, ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } } },
    });
    if (itemsJalados > 0) {
      return { error: "No se puede eliminar: ya hay una orden de compra que jaló productos de esta solicitud." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitudPedidoItem.deleteMany({ where: { solicitudPedidoId: id } });
      await tx.solicitudPedido.delete({ where: { id } });
    });

    revalidatePath("/logistica/solicitudes-pedido");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarSolicitudPedidoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la solicitud." };
  }
}
