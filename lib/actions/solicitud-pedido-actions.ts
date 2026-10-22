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
  const { categoria, fecha, fechaNecesidad, tipoNecesidad, justificacion, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();
    // El área solo es editable para Supply Chain y ADMIN (ver
    // solicitud-pedido-form.tsx); para cualquier otro usuario se fuerza la
    // suya propia aquí, sin confiar en el valor que llegó del cliente.
    const areaPuedeElegir = !usuario?.area || usuario.area === "SUPPLY_CHAIN" || usuario.roles.includes("ADMIN");
    const area = areaPuedeElegir ? parsed.data.area : (usuario!.area as typeof parsed.data.area);

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

// Puede editar: quien la creó, o Supply Chain/ADMIN (mismo criterio que
// "areaEditable" al crear, porque gestionan pedidos de cualquier área en
// nombre de otros). No depende de ningún rol de aprobador/anulador.
function puedeEditarSolicitud(usuario: { id: string; area: string | null; roles: string[] }, solicitud: { creadoPorId: string | null }) {
  return usuario.roles.includes("ADMIN") || usuario.area === "SUPPLY_CHAIN" || solicitud.creadoPorId === usuario.id;
}

// Edita una solicitud existente — solo si todavía no fue "jalada" por
// ninguna OC/OS activa (si la única que la jaló está ANULADA/RECHAZADA, se
// puede volver a editar). Si ya estaba APROBADA, el edit la regresa a
// PENDIENTE (mostrado como "Borrador" en la UI) y reinicia la decisión de
// cada línea a PENDIENTE: cualquier cambio invalida la aprobación previa y
// exige que se vuelva a revisar completa.
export async function editarSolicitudPedidoAction(
  id: string,
  data: SolicitudPedidoInput
): Promise<SolicitudPedidoActionState> {
  const parsed = solicitudPedidoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para editar una solicitud." };

    const solicitud = await prisma.solicitudPedido.findUnique({
      where: { id },
      include: { items: { include: { ordenCompraItems: { include: { ordenCompra: true } } } } },
    });
    if (!solicitud) return { error: "La solicitud ya no existe." };

    if (!puedeEditarSolicitud(usuario, solicitud)) {
      return { error: "No tienes permiso para editar esta solicitud." };
    }
    if (solicitud.estado === "RECHAZADO" || solicitud.estado === "ANULADO") {
      return { error: "Esta solicitud ya no está activa." };
    }
    const fueJalada = solicitud.items.some((item) =>
      item.ordenCompraItems.some((oci) => oci.ordenCompra.estado !== "RECHAZADO" && oci.ordenCompra.estado !== "ANULADO")
    );
    if (fueJalada) {
      return {
        error: "Ya se generó una orden de compra/servicio con productos de esta solicitud. Anúlala primero para poder editar.",
      };
    }

    // Una línea con CUALQUIER historial de OC (incluida una ya anulada) no
    // se puede borrar: la fila OrdenCompraItem sigue apuntando a ella y la
    // base de datos no deja romper esa referencia. Si el usuario la quitó
    // del formulario, se avisa en vez de fallar a medio guardar.
    const idsEnviados = new Set(parsed.data.items.map((item) => item.id).filter((itemId): itemId is string => !!itemId));
    const itemsConHistorial = solicitud.items.filter((item) => item.ordenCompraItems.length > 0);
    const itemsQueNoSePuedenQuitar = itemsConHistorial.filter((item) => !idsEnviados.has(item.id));
    if (itemsQueNoSePuedenQuitar.length > 0) {
      return {
        error: `No se puede quitar la línea de ${itemsQueNoSePuedenQuitar.length} producto(s) con historial de una orden de compra/servicio (aunque esté anulada). Déjala en el formulario.`,
      };
    }

    const { categoria, fecha, fechaNecesidad, tipoNecesidad, justificacion, items } = parsed.data;
    const areaPuedeElegir = !usuario.area || usuario.area === "SUPPLY_CHAIN" || usuario.roles.includes("ADMIN");
    const area = areaPuedeElegir ? parsed.data.area : (usuario.area as typeof parsed.data.area);

    await prisma.$transaction(async (tx) => {
      await tx.solicitudPedido.update({
        where: { id },
        data: {
          categoria,
          area,
          estado: "PENDIENTE",
          fecha,
          fechaNecesidad,
          tipoNecesidad,
          justificacion: justificacion || null,
          aprobadoPorId: null,
          fechaAprobacion: null,
          comentarioRechazo: null,
        },
      });

      const idsExistentes = new Set(solicitud.items.map((item) => item.id));
      for (const item of items) {
        const datosItem = {
          skuId: item.skuId,
          cantidad: item.cantidad,
          unidadMedida: item.unidadMedida,
          centroCosto: item.centroCosto,
          descripcion: item.descripcion || null,
          campo: item.campo || null,
          estado: "PENDIENTE" as const,
        };
        if (item.id && idsExistentes.has(item.id)) {
          await tx.solicitudPedidoItem.update({ where: { id: item.id }, data: datosItem });
        } else {
          await tx.solicitudPedidoItem.create({ data: { solicitudPedidoId: id, ...datosItem } });
        }
      }

      const idsAEliminar = solicitud.items.map((item) => item.id).filter((itemId) => !idsEnviados.has(itemId));
      if (idsAEliminar.length > 0) {
        await tx.solicitudPedidoItem.deleteMany({ where: { id: { in: idsAEliminar } } });
      }
    });

    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath(`/logistica/solicitudes-pedido/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en editarSolicitudPedidoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la solicitud." };
  }
}

async function verificarPermisoAprobacion(area: string): Promise<{ usuarioId: string } | { error: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión para aprobar o rechazar solicitudes." };

  const aprobadores = await obtenerAprobadoresArea();
  const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));

  if (!puedeAprobarSolicitud({ usuarioId: usuario.id, email: usuario.email, roles: usuario.roles, area, aprobadoresPorArea })) {
    return { error: "No tienes permiso para aprobar o rechazar solicitudes de esta área." };
  }
  return { usuarioId: usuario.id };
}

// Aprueba o rechaza UNA línea puntual de la solicitud (ver
// EstadoItemSolicitud) — ya no hay un "aprobar/rechazar" a nivel de todo el
// documento desde la lista; el aprobador entra al detalle, decide cada
// línea con estos botones, y recién al final usa
// finalizarAprobacionSolicitudAction.
export async function decidirItemSolicitudAction(
  itemId: string,
  decision: "APROBADO" | "RECHAZADO"
): Promise<{ error?: string } | undefined> {
  try {
    const item = await prisma.solicitudPedidoItem.findUnique({
      where: { id: itemId },
      include: { solicitudPedido: true },
    });
    if (!item) return { error: "El ítem ya no existe." };
    if (item.solicitudPedido.estado !== "PENDIENTE") {
      return { error: "Solo se pueden decidir ítems de una solicitud pendiente." };
    }

    const permiso = await verificarPermisoAprobacion(item.solicitudPedido.area);
    if ("error" in permiso) return permiso;

    await prisma.solicitudPedidoItem.update({ where: { id: itemId }, data: { estado: decision } });

    revalidatePath(`/logistica/solicitudes-pedido/${item.solicitudPedidoId}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en decidirItemSolicitudAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al decidir el ítem." };
  }
}

// Cierra la revisión de la solicitud: exige que cada línea ya tenga una
// decisión (ninguna en PENDIENTE) y, según el resultado, deja el
// documento completo APROBADO (si quedó al menos una línea aprobada) o
// RECHAZADO (si se rechazaron todas).
export async function finalizarAprobacionSolicitudAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const solicitud = await prisma.solicitudPedido.findUnique({ where: { id }, include: { items: true } });
    if (!solicitud) return { error: "La solicitud ya no existe." };
    if (solicitud.estado !== "PENDIENTE") {
      return { error: "Solo se puede finalizar la aprobación de una solicitud pendiente." };
    }
    if (solicitud.items.some((item) => item.estado === "PENDIENTE")) {
      return { error: "Aprueba o rechaza todos los productos antes de finalizar la aprobación." };
    }

    const permiso = await verificarPermisoAprobacion(solicitud.area);
    if ("error" in permiso) return permiso;

    const hayAlgunoAprobado = solicitud.items.some((item) => item.estado === "APROBADO");

    await prisma.solicitudPedido.update({
      where: { id },
      data: {
        estado: hayAlgunoAprobado ? "APROBADO" : "RECHAZADO",
        aprobadoPorId: permiso.usuarioId,
        fechaAprobacion: new Date(),
        comentarioRechazo: hayAlgunoAprobado ? null : "Se rechazaron todos los productos de la solicitud.",
      },
    });

    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath(`/logistica/solicitudes-pedido/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en finalizarAprobacionSolicitudAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al finalizar la aprobación." };
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
