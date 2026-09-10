import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
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
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Solicitudes de pedido"
        descripcion="Solicitudes internas de compra de insumos y materiales, punto de partida del flujo de abastecimiento hacia las órdenes de compra."
      />

      {solicitudes.length === 0 ? (
        <EmptyState
          icono={ClipboardList}
          titulo="Aún no hay solicitudes de pedido"
          descripcion="En una fase futura podrás crear solicitudes de pedido desde aquí, enviarlas a aprobación y convertirlas en órdenes de compra."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>N.º de ítems</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solicitudes.map((solicitud) => (
              <TableRow key={solicitud.id}>
                <TableCell className="font-medium">{solicitud.numero}</TableCell>
                <TableCell>{solicitud.area ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[solicitud.estado]}>{ESTADO_LABEL[solicitud.estado]}</Badge>
                </TableCell>
                <TableCell>{formatDate(solicitud.fecha)}</TableCell>
                <TableCell>{solicitud._count.items}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
