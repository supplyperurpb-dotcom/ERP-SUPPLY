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
import { CATEGORIAS_COMPRA } from "@/lib/constants/compras";
import { eliminarOrdenCompraAction } from "@/lib/actions/orden-compra-actions";
import { getUsuarioActual } from "@/lib/auth/session";
import { AprobarRechazarOrdenBotones } from "./aprobar-rechazar-botones";
import type { EstadoDocumento, AreaEmpresa } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
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
  const usuario = await getUsuarioActual();

  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;
  // Igual que en Solicitudes de pedido: todo usuario con área asignada
  // (sea o no aprobador) solo ve las OC/OS que tengan al menos una línea
  // de su propia área; solo ADMIN ve todas.
  const areaUsuario = usuario && !esAdmin ? usuario.area : null;

  const ordenes = await prisma.ordenCompra.findMany({
    where: areaUsuario ? { items: { some: { centroCosto: areaUsuario as AreaEmpresa } } } : undefined,
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
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/logistica/ordenes-compra/nuevo?categoria=SERVICIO">
                <Plus className="mr-2 h-4 w-4" />
                Nueva de servicio
              </Link>
            </Button>
            <Button asChild>
              <Link href="/logistica/ordenes-compra/nuevo?categoria=COMPRA">
                <Plus className="mr-2 h-4 w-4" />
                Nueva de compra
              </Link>
            </Button>
          </div>
        }
      />

      {ordenes.length === 0 ? (
        <EmptyState
          icono={ShoppingCart}
          titulo="Aún no hay órdenes de compra ni de servicio"
          descripcion="Genera la primera con los botones de arriba, jalando ítems pendientes de una o varias solicitudes de la misma categoría."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estatus</TableHead>
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
                <TableCell>
                  <Badge variant={orden.categoria === "SERVICIO" ? "secondary" : "success"}>
                    {CATEGORIAS_COMPRA.find((c) => c.valor === orden.categoria)?.nombre ?? orden.categoria}
                  </Badge>
                </TableCell>
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
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {esAdmin && orden.estado === "PENDIENTE" && (
                      <AprobarRechazarOrdenBotones id={orden.id} numero={orden.numero} />
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/logistica/ordenes-compra/${orden.id}`}>Ver</Link>
                    </Button>
                    <EliminarMovimientoButton
                      id={orden.id}
                      numero={orden.numero}
                      etiqueta="la orden de compra"
                      accion={eliminarOrdenCompraAction}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
