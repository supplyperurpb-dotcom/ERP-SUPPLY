import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { SolicitudesTrasladoTable, type FilaSolicitudTraslado, type EstadoSolicitudTraslado } from "./solicitudes-traslado-table";

export default async function SolicitudesTrasladoPage() {
  const solicitudes = await prisma.solicitudTraslado.findMany({
    include: {
      almacenOrigen: true,
      almacenDestino: true,
      _count: { select: { items: true } },
      items: { select: { cantidad: true, trasladoAlmacenItems: { select: { cantidad: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const filas: FilaSolicitudTraslado[] = solicitudes.map((solicitud) => {
    const totalSolicitado = solicitud.items.reduce((acc, item) => acc + Number(item.cantidad), 0);
    const totalMovido = solicitud.items.reduce(
      (acc, item) => acc + item.trasladoAlmacenItems.reduce((a, t) => a + Number(t.cantidad), 0),
      0
    );
    const estado: EstadoSolicitudTraslado = totalMovido <= 0 ? "PENDIENTE" : totalMovido >= totalSolicitado ? "EJECUTADA" : "PARCIAL";
    return {
      id: solicitud.id,
      numero: solicitud.numero,
      almacenOrigen: solicitud.almacenOrigen.nombre,
      almacenDestino: solicitud.almacenDestino.nombre,
      fecha: formatDate(solicitud.fecha),
      numItems: solicitud._count.items,
      estado,
      puedeEliminar: totalMovido <= 0,
    };
  });

  return (
    <div>
      <PageHeader
        titulo="Solicitudes de traslado"
        descripcion="Solicitudes internas para mover stock propio entre almacenes. No requieren aprobación: quedan listas para ejecutarse apenas se crean."
        acciones={
          <Button asChild>
            <Link href="/logistica/solicitudes-traslado/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva solicitud de traslado
            </Link>
          </Button>
        }
      />

      {solicitudes.length === 0 ? (
        <EmptyState
          icono={ArrowLeftRight}
          titulo="Aún no hay solicitudes de traslado"
          descripcion="Registra la primera con el botón de arriba."
        />
      ) : (
        <SolicitudesTrasladoTable filas={filas} />
      )}
    </div>
  );
}
