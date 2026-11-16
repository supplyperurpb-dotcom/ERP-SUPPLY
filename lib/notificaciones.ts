import { prisma } from "@/lib/db/prisma";
import { NOMBRE_ORDEN } from "@/lib/constants/compras";
import { obtenerAprobadoresEspeciales } from "@/lib/compras";
import type { UsuarioActual } from "@/lib/auth/session";

export type NotificacionPendiente = {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
};

// Campana de notificaciones (Topbar): junta 2 alertas pedidas explícitamente —
// 1) OC/OS con firma pendiente del rol especial del usuario actual (mismo
//    criterio de "quién puede firmar ahora" que ordenes-compra/[id]/page.tsx,
//    ver firmaQuePuedeUsar: el ADMIN siempre cuenta como respaldo); y
// 2) Registros de avance (Gestión de Servicios) pendientes de VB — llega a
//    quien el comprador le pidió el VB al enviar la solicitud, y además
//    siempre al ADMIN (pedido explícito: "debe quedar asignado a quien se
//    le solicita... al admin siempre le debe llegar todo", mismo criterio
//    de respaldo que el resto de flujos de aprobación de este ERP).
export async function obtenerNotificacionesPendientes(usuario: UsuarioActual): Promise<NotificacionPendiente[]> {
  const esAdmin = usuario.roles.includes("ADMIN");

  const [aprobadoresEspeciales, firmasPendientes, registrosPendientesVb] = await Promise.all([
    obtenerAprobadoresEspeciales(),
    prisma.ordenCompraFirma.findMany({
      where: {
        estado: "PENDIENTE",
        ordenCompra: { estado: { in: ["BORRADOR", "PENDIENTE"] } },
      },
      include: { ordenCompra: { include: { proveedor: true } } },
    }),
    prisma.registroAvance.findMany({
      where: { estado: "PENDIENTE_VB", ...(esAdmin ? {} : { aprobadorId: usuario.id }) },
      include: { servicioGestionado: { include: { ordenCompra: { include: { proveedor: true } } } } },
    }),
  ]);

  const aprobadorPorRolEspecial = new Map(aprobadoresEspeciales.map((a) => [a.rol, a.usuarioId]));

  const notificacionesFirmas: NotificacionPendiente[] = firmasPendientes
    .filter((firma) => aprobadorPorRolEspecial.get(firma.rol) === usuario.id || esAdmin)
    .map((firma) => ({
      id: `firma-${firma.id}`,
      titulo: `${NOMBRE_ORDEN[firma.ordenCompra.categoria]} ${firma.ordenCompra.numero} pendiente de aprobar`,
      descripcion: firma.ordenCompra.proveedor.razonSocial,
      href: `/logistica/ordenes-compra/${firma.ordenCompraId}`,
    }));

  const notificacionesVb: NotificacionPendiente[] = registrosPendientesVb.map((registro) => ({
    id: `vb-${registro.id}`,
    titulo: `Avance OS ${registro.servicioGestionado.ordenCompra.numero} pendiente de VB`,
    descripcion: `Registro de Avance ${registro.numero} · ${registro.servicioGestionado.ordenCompra.proveedor.razonSocial}`,
    href: `/logistica/gestion-servicios/${registro.servicioGestionado.ordenCompraId}/registro/${registro.numero}`,
  }));

  return [...notificacionesFirmas, ...notificacionesVb];
}
