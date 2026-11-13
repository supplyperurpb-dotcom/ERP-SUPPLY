"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { calcularStockDisponibleDespacho, esDeAreaAlmacen } from "@/lib/stock-almacen";
import { puedeVerCampoPacking } from "@/lib/compras";
import { solicitudDespachoSchema, type SolicitudDespachoInput } from "@/lib/validations/solicitud-despacho";

export type SolicitudDespachoActionState = { error?: string; id?: string; numero?: string } | undefined;

// No necesita aprobación: queda lista para atenderse apenas se crea, igual
// que la antigua Solicitud de Traslado. Quien pide no elige almacén (eso lo
// decide Almacén al atenderla con un Consumo normal — ver
// consumo-almacen-actions.ts); el stock disponible que ve el formulario es
// el físico de todos los almacenes MENOS lo que ya está pendiente de
// atender en otras solicitudes abiertas (calcularStockDisponibleDespacho),
// para que dos solicitudes no puedan pedir, cada una por su cuenta, más de
// lo que en realidad hay.
export async function crearSolicitudDespachoAction(data: SolicitudDespachoInput): Promise<SolicitudDespachoActionState> {
  const parsed = solicitudDespachoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, hora, observaciones, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();
    // A diferencia de SolicitudPedido, acá el área siempre sale bloqueada
    // en el formulario (es la del usuario que pide, sin excepción): se
    // fuerza aquí también, sin confiar en el valor que llegó del cliente.
    const area = (usuario?.area as typeof parsed.data.area | null) ?? parsed.data.area;

    // "Packing" no sale en el combo de quien no es comprador ni Carlos
    // Gozzer (ver puedeVerCampoPacking), pero igual se revalida acá: nunca
    // se confía en que el cliente no lo haya mandado armado a mano.
    if (items.some((item) => item.campo === "Packing") && !(usuario && puedeVerCampoPacking(usuario))) {
      return { error: "No tienes permiso para usar el campo 'Packing'." };
    }

    const cantidadPorSku = new Map<string, number>();
    for (const item of items) {
      cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
    }
    const stockDisponible = await calcularStockDisponibleDespacho();
    const disponiblePorSku = new Map(stockDisponible.map((s) => [s.skuId, s.cantidad]));
    for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
      const disponible = disponiblePorSku.get(skuId) ?? 0;
      if (cantidadSolicitada > disponible) {
        const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
        return {
          error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ningún almacén (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
        };
      }
    }

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const existentes = await tx.solicitudDespacho.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((s) => s.numero), "SD-");

      const solicitud = await tx.solicitudDespacho.create({
        data: {
          numero,
          area,
          fecha,
          hora: hora || null,
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
            centroCosto: item.centroCosto,
            campo: item.campo || null,
          },
        });
      }

      return solicitud;
    });

    revalidatePath("/logistica/solicitudes-despacho");
    return { id: nuevaSolicitud.id, numero: nuevaSolicitud.numero };
  } catch (e) {
    console.error("Error inesperado en crearSolicitudDespachoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la solicitud." };
  }
}

// Igual que la antigua Solicitud de Traslado: no hay estado de aprobación
// que proteja el borrado, solo que ningún consumo ya haya atendido alguna
// de sus líneas.
// Puede eliminar: un ADMIN siempre, o quien la generó — pero nunca quien
// pertenezca al área Almacén (ni siquiera la que él mismo generó): es
// quien la atiende, no debería poder esquivarla borrándola. Mismo
// criterio que la bandeja y el detalle (ver
// solicitudes-despacho/page.tsx), revalidado acá porque nunca se confía
// solo en que el botón esté oculto del lado del cliente.
function puedeEliminarSolicitud(
  usuario: { id: string; roles: string[]; area: string | null; areaDetalle: string | null },
  solicitud: { solicitanteId: string | null }
) {
  if (usuario.roles.includes("ADMIN")) return true;
  if (esDeAreaAlmacen(usuario)) return false;
  return solicitud.solicitanteId === usuario.id;
}

export async function eliminarSolicitudDespachoAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };

    const solicitud = await prisma.solicitudDespacho.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };

    if (!puedeEliminarSolicitud(usuario, solicitud)) {
      return { error: "No tienes permiso para eliminar esta solicitud." };
    }

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
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarSolicitudDespachoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la solicitud." };
  }
}
