import Link from "next/link";
import { PackageMinus, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { SolicitudesDespachoTable, type FilaSolicitudDespacho, type EstadoSolicitudDespacho } from "./solicitudes-despacho-table";

export default async function SolicitudesDespachoPage() {
  const solicitudes = await prisma.solicitudDespacho.findMany({
    include: {
      _count: { select: { items: true } },
      items: { select: { cantidad: true, consumoAlmacenItems: { select: { cantidad: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // SolicitudDespacho.solicitanteId no tiene relación Prisma a Usuario
  // (ver el comentario en el schema) — se resuelve aparte.
  const solicitanteIds = [...new Set(solicitudes.map((s) => s.solicitanteId).filter((id): id is string => !!id))];
  const solicitantes = solicitanteIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: solicitanteIds } }, select: { id: true, nombres: true, apellidos: true } })
    : [];
  const solicitantePorId = new Map(solicitantes.map((u) => [u.id, `${u.nombres} ${u.apellidos}`]));

  const filas: FilaSolicitudDespacho[] = solicitudes.map((solicitud) => {
    const totalSolicitado = solicitud.items.reduce((acc, item) => acc + Number(item.cantidad), 0);
    const totalAtendido = solicitud.items.reduce(
      (acc, item) => acc + item.consumoAlmacenItems.reduce((a, c) => a + Number(c.cantidad), 0),
      0
    );
    const estado: EstadoSolicitudDespacho = totalAtendido <= 0 ? "PENDIENTE" : totalAtendido >= totalSolicitado ? "ATENDIDA" : "PARCIAL";
    return {
      id: solicitud.id,
      numero: solicitud.numero,
      area: AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area,
      areaCodigo: solicitud.area,
      fecha: formatDate(solicitud.fecha),
      solicitante: solicitud.solicitanteId ? solicitantePorId.get(solicitud.solicitanteId) ?? "—" : "—",
      numItems: solicitud._count.items,
      estado,
      puedeEliminar: totalAtendido <= 0,
    };
  });

  return (
    <div>
      <PageHeader
        titulo="Solicitudes de despacho"
        descripcion="Pide que Almacén te despache stock disponible. No requieren aprobación: quedan listas para atenderse apenas se crean."
        acciones={
          <Button asChild>
            <Link href="/logistica/solicitudes-despacho/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva solicitud de despacho
            </Link>
          </Button>
        }
      />

      {solicitudes.length === 0 ? (
        <EmptyState
          icono={PackageMinus}
          titulo="Aún no hay solicitudes de despacho"
          descripcion="Registra la primera con el botón de arriba."
        />
      ) : (
        <SolicitudesDespachoTable filas={filas} />
      )}
    </div>
  );
}
