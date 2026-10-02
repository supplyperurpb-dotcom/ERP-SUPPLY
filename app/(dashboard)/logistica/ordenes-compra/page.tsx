import Link from "next/link";
import { ShoppingCart, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { formatDate, formatMoneda } from "@/lib/utils";
import { eliminarOrdenCompraAction } from "@/lib/actions/orden-compra-actions";
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
    take: 100,
  });

  return (
    <div>
      <PageHeader
        titulo="Órdenes de compra"
        descripcion="Órdenes de compra emitidas a proveedores de insumos, generadas a partir de solicitudes de pedido."
        acciones={
          <Button asChild>
            <Link href="/logistica/ordenes-compra/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva orden de compra
            </Link>
          </Button>
        }
      />

      {ordenes.length === 0 ? (
        <EmptyState
          icono={ShoppingCart}
          titulo="Aún no hay órdenes de compra"
          descripcion="Genera la primera orden de compra con el botón 'Nueva orden de compra' de arriba, jalando ítems pendientes de una o varias solicitudes."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">IGV</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
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
                <TableCell className="text-right">{formatMoneda(orden.subtotal.toString(), orden.moneda)}</TableCell>
                <TableCell className="text-right">{formatMoneda(orden.igv.toString(), orden.moneda)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoneda(orden.montoTotal.toString(), orden.moneda)}
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/ordenes-compra/${orden.id}`}>Ver</Link>
                  </Button>
                  <EliminarMovimientoButton
                    id={orden.id}
                    numero={orden.numero}
                    etiqueta="la orden de compra"
                    accion={eliminarOrdenCompraAction}
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
