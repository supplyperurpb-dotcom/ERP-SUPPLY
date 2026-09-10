import { ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoneda } from "@/lib/utils";
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

export default async function OrdenesCompraPage() {
  const ordenes = await prisma.ordenCompra.findMany({
    include: { proveedor: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Órdenes de compra"
        descripcion="Órdenes de compra emitidas a proveedores de insumos, generadas a partir de solicitudes de pedido aprobadas."
      />

      {ordenes.length === 0 ? (
        <EmptyState
          icono={ShoppingCart}
          titulo="Aún no hay órdenes de compra"
          descripcion="En una fase futura podrás generar órdenes de compra a partir de una solicitud de pedido aprobada y enviarlas al proveedor."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Monto total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenes.map((orden) => (
              <TableRow key={orden.id}>
                <TableCell className="font-medium">{orden.numero}</TableCell>
                <TableCell>{orden.proveedor.razonSocial}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[orden.estado]}>{ESTADO_LABEL[orden.estado]}</Badge>
                </TableCell>
                <TableCell>{formatDate(orden.fecha)}</TableCell>
                <TableCell>{formatMoneda(orden.montoTotal.toString(), orden.moneda)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
