"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { PREFIJO_SOLICITUD } from "@/lib/constants/compras";
import { obtenerAprobadoresArea, puedeAprobarSolicitud } from "@/lib/compras";
import {
  solicitudPedidoSchema,
  aprobadoresAreaSchema,
  aprobadoresEspecialesSchema,
  rechazarSolicitudPedidoSchema,
  type SolicitudPedidoInput,
  type AprobadoresAreaInput,
  type AprobadoresEspecialesInput,
} from "@/lib/validations/compras";

export type SolicitudPedidoActionState = { error?: string; id?: string } | undefined;

export async function crearSolicitudPedidoAction(data: SolicitudPedidoInput): Promise<SolicitudPedidoActionState> {
  const parsed = solicitudPedidoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { categoria, area, fecha, fechaNecesidad, tipoNecesidad, justificacion, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const existentes = await tx.solicitudPedido.findMany({ where: { categoria }, select: { numero: true } });
      const numero = siguienteNumero(existentes.map((s) => s.numero), PREFIJO_SOLICITUD[categoria], 9);

      const solicitud = await tx.solicitudPedido.create({
        data: {
          numero,
          categoria,
          area,
          estado: "PENDIENTE",
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
            descripcion: item.descripcion || null,
            campo: item.campo || null,
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

async function verificarPermisoAprobacion(area: string): Promise<{ usuarioId: string } | { error: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión para aprobar o rechazar solicitudes." };

  const aprobadores = await obtenerAprobadoresArea();
  const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));

  if (!puedeAprobarSolicitud({ usuarioId: usuario.id, roles: usuario.roles, area, aprobadoresPorArea })) {
    return { error: "No tienes permiso para aprobar o rechazar solicitudes de esta área." };
  }
  return { usuarioId: usuario.id };
}

export async function aprobarSolicitudPedidoAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const solicitud = await prisma.solicitudPedido.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };
    if (solicitud.estado !== "PENDIENTE") {
      return { error: "Solo se pueden aprobar solicitudes pendientes." };
    }

    const permiso = await verificarPermisoAprobacion(solicitud.area);
    if ("error" in permiso) return permiso;

    await prisma.solicitudPedido.update({
      where: { id },
      data: {
        estado: "APROBADO",
        aprobadoPorId: permiso.usuarioId,
        fechaAprobacion: new Date(),
        comentarioRechazo: null,
      },
    });

    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath(`/logistica/solicitudes-pedido/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en aprobarSolicitudPedidoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al aprobar la solicitud." };
  }
}

export async function rechazarSolicitudPedidoAction(
  id: string,
  comentario?: string
): Promise<{ error?: string } | undefined> {
  const parsed = rechazarSolicitudPedidoSchema.safeParse({ comentario });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const solicitud = await prisma.solicitudPedido.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };
    if (solicitud.estado !== "PENDIENTE") {
      return { error: "Solo se pueden rechazar solicitudes pendientes." };
    }

    const permiso = await verificarPermisoAprobacion(solicitud.area);
    if ("error" in permiso) return permiso;

    await prisma.solicitudPedido.update({
      where: { id },
      data: {
        estado: "RECHAZADO",
        aprobadoPorId: permiso.usuarioId,
        fechaAprobacion: new Date(),
        comentarioRechazo: parsed.data.comentario || null,
      },
    });

    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath(`/logistica/solicitudes-pedido/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en rechazarSolicitudPedidoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al rechazar la solicitud." };
  }
}

// Anular reemplaza por completo a "eliminar": es exclusivo de quien tenga
// el rol ANULADOR, sin importar el estado de la solicitud (ni ADMIN, ni
// APROBADOR_GENERAL, ni el aprobador del área lo habilitan por sí solos).
// Antes de estar aprobada (PENDIENTE/BORRADOR) se borra directamente; ya
// APROBADA, no se borra — queda en estado ANULADO para dejar rastro de
// quién la anuló y por qué. Si ya hay una OC que jaló de esta solicitud,
// no se puede anular en ningún caso.
export async function anularSolicitudPedidoAction(id: string, comentario?: string): Promise<{ error?: string } | undefined> {
  const parsed = rechazarSolicitudPedidoSchema.safeParse({ comentario });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para anular una solicitud." };
    if (!usuario.roles.includes("ANULADOR")) {
      return { error: "No tienes permiso para anular solicitudes de pedido." };
    }

    const solicitud = await prisma.solicitudPedido.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };
    if (solicitud.estado === "RECHAZADO" || solicitud.estado === "ANULADO") {
      return { error: "Esta solicitud ya no está activa." };
    }

    const itemsJalados = await prisma.ordenCompraItem.count({
      where: { solicitudPedidoItem: { solicitudPedidoId: id }, ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } } },
    });
    if (itemsJalados > 0) {
      return { error: "No se puede anular: ya hay una orden de compra que jaló productos de esta solicitud." };
    }

    if (solicitud.estado === "APROBADO") {
      await prisma.solicitudPedido.update({
        where: { id },
        data: {
          estado: "ANULADO",
          aprobadoPorId: usuario.id,
          fechaAprobacion: new Date(),
          comentarioRechazo: parsed.data.comentario || null,
        },
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.solicitudPedidoItem.deleteMany({ where: { solicitudPedidoId: id } });
        await tx.solicitudPedido.delete({ where: { id } });
      });
    }

    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath(`/logistica/solicitudes-pedido/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en anularSolicitudPedidoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al anular la solicitud." };
  }
}

export async function configurarAprobadoresAreaAction(
  data: AprobadoresAreaInput
): Promise<{ error?: string } | undefined> {
  const parsed = aprobadoresAreaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const usuario = await getUsuarioActual();
    if (!usuario || !usuario.roles.includes("ADMIN")) {
      return { error: "Solo un administrador puede configurar los aprobadores por área." };
    }

    await prisma.$transaction(
      parsed.data.asignaciones.map((asignacion) =>
        prisma.aprobadorArea.upsert({
          where: { area: asignacion.area },
          create: { area: asignacion.area, usuarioId: asignacion.usuarioId },
          update: { usuarioId: asignacion.usuarioId },
        })
      )
    );

    revalidatePath("/logistica/solicitudes-pedido/aprobadores");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en configurarAprobadoresAreaAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al guardar los aprobadores." };
  }
}

// Asigna qué usuario ocupa cada rol especial (Gerente de Supply, District
// Controller, Gerente General, Gerente de RRHH), usados para aprobar
// cualquier Solped sin restricción de área y para las firmas de OC/OS por
// monto (ver rolesFirmaRequeridos en lib/compras.ts).
export async function configurarAprobadoresEspecialesAction(
  data: AprobadoresEspecialesInput
): Promise<{ error?: string } | undefined> {
  const parsed = aprobadoresEspecialesSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const usuario = await getUsuarioActual();
    if (!usuario || !usuario.roles.includes("ADMIN")) {
      return { error: "Solo un administrador puede configurar los aprobadores especiales." };
    }

    await prisma.$transaction(
      parsed.data.asignaciones.map((asignacion) =>
        prisma.aprobadorEspecial.upsert({
          where: { rol: asignacion.rol },
          create: { rol: asignacion.rol, usuarioId: asignacion.usuarioId },
          update: { usuarioId: asignacion.usuarioId },
        })
      )
    );

    revalidatePath("/logistica/solicitudes-pedido/aprobadores");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en configurarAprobadoresEspecialesAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al guardar los aprobadores especiales." };
  }
}
