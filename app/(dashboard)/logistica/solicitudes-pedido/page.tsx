import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { formatDate } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD } from "@/lib/constants/compras";
import { eliminarSolicitudPedidoAction } from "@/lib/actions/solicitud-pedido-actions";
import type { EstadoDocumento } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  ANULADO: "Anulado",
};

const ESTADO_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

export default async function SolicitudesPedidoPage() {
  const solicitudes = await prisma.solicitudPedido.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        titulo="Solicitudes de pedido"
        descripcion="Solicitudes internas de compra de insumos y materiales, punto de partida del flujo de abastecimiento hacia las órdenes de compra."
        acciones={
          <Button asChild>
            <Link href="/logistica/solicitudes-pedido/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva solicitud
            </Link>
          </Button>
        }
      />

      {solicitudes.length === 0 ? (
        <EmptyState
          icono={ClipboardList}
          titulo="Aún no hay solicitudes de pedido"
          descripcion="Registra la primera solicitud con el botón 'Nueva solicitud' de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Fecha necesidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">N.º de ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solicitudes.map((solicitud) => (
              <TableRow key={solicitud.id}>
                <TableCell className="font-medium">{solicitud.numero}</TableCell>
                <TableCell>{AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area}</TableCell>
                <TableCell>
                  {TIPOS_NECESIDAD.find((t) => t.valor === solicitud.tipoNecesidad)?.nombre ?? solicitud.tipoNecesidad}
                </TableCell>
                <TableCell>{formatDate(solicitud.fecha)}</TableCell>
                <TableCell>{formatDate(solicitud.fechaNecesidad)}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[solicitud.estado]}>{ESTADO_LABEL[solicitud.estado]}</Badge>
                </TableCell>
                <TableCell className="text-right">{solicitud._count.items}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/solicitudes-pedido/${solicitud.id}`}>Ver</Link>
                  </Button>
                  <EliminarMovimientoButton
                    id={solicitud.id}
                    numero={solicitud.numero}
                    etiqueta="la solicitud"
                    accion={eliminarSolicitudPedidoAction}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
