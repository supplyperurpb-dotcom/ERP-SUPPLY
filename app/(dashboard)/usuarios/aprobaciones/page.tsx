import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  SOLICITUD_PEDIDO: "Solicitud de pedido",
  ORDEN_COMPRA: "Orden de compra",
};

export default async function AprobacionesPage() {
  const pendientes = await prisma.aprobacion.findMany({
    where: { estado: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Pendientes de aprobación"
        descripcion="Bandeja visible para usuarios con rol Aprobador. Muestra los documentos que están esperando una decisión según las reglas de aprobación configuradas."
      />

      {pendientes.length === 0 ? (
        <EmptyState
          icono={ShieldCheck}
          titulo="No hay documentos pendientes de aprobación"
          descripcion="Cuando una solicitud de pedido u orden de compra supere el umbral configurado, aparecerá aquí para su revisión."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de documento</TableHead>
              <TableHead>N.º de documento</TableHead>
              <TableHead>Fecha de creación</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendientes.map((aprobacion) => (
              <TableRow key={aprobacion.id}>
                <TableCell className="font-medium">
                  {TIPO_DOCUMENTO_LABEL[aprobacion.tipoDocumento] ?? aprobacion.tipoDocumento}
                </TableCell>
                <TableCell>{aprobacion.documentoNumero ?? "—"}</TableCell>
                <TableCell>{formatDateTime(aprobacion.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">Pendiente</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
