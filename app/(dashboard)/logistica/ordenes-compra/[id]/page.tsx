import { notFound } from "next/navigation";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatMoneda } from "@/lib/utils";
import { AREAS_EMPRESA, IGV_TASA } from "@/lib/constants/compras";
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

function nombreArea(valor: string) {
  return AREAS_EMPRESA.find((a) => a.valor === valor)?.nombre ?? valor;
}

export default async function OrdenCompraDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: { include: { sku: true, solicitudPedidoItem: { include: { solicitudPedido: true } } } },
    },
  });

  if (!orden) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Orden de compra ${orden.numero}`}
        descripcion={`${orden.proveedor.razonSocial} · ${formatDate(orden.fecha)}`}
        acciones={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={`/api/pdf/orden-compra/${orden.id}`} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            <EliminarMovimientoButton
              id={orden.id}
              numero={orden.numero}
              etiqueta="la orden de compra"
              accion={eliminarOrdenCompraAction}
              redirectTo="/logistica/ordenes-compra"
            />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Estado</p>
            <Badge variant={ESTADO_VARIANT[orden.estado]}>{ESTADO_LABEL[orden.estado]}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Proveedor</p>
            <p className="font-medium">{orden.proveedor.razonSocial}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha</p>
            <p className="font-medium">{formatDate(orden.fecha)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Moneda</p>
            <p className="font-medium">{orden.moneda}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Solicitud origen</TableHead>
                  <TableHead>Centro de costo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">P. Unit.</TableHead>
                  <TableHead>Gravado</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.sku.codigo}</TableCell>
                    <TableCell>{item.sku.descripcion}</TableCell>
                    <TableCell>
                      {item.solicitudPedidoItem ? (
                        <Link
                          href={`/logistica/solicitudes-pedido/${item.solicitudPedidoItem.solicitudPedidoId}`}
                          className="underline underline-offset-2"
                        >
                          {item.solicitudPedidoItem.solicitudPedido.numero}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{nombreArea(item.centroCosto)}</TableCell>
                    <TableCell className="text-right">
                      {Number(item.cantidad)} {item.sku.unidadMedida}
                    </TableCell>
                    <TableCell className="text-right">{formatMoneda(item.precioUnitario.toString(), orden.moneda)}</TableCell>
                    <TableCell>{item.gravado ? "Sí" : "No"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoneda(item.subtotal.toString(), orden.moneda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Subtotal: <span className="font-medium">{formatMoneda(orden.subtotal.toString(), orden.moneda)}</span>
            </p>
            <p>
              IGV ({Math.round(IGV_TASA * 100)}%):{" "}
              <span className="font-medium">{formatMoneda(orden.igv.toString(), orden.moneda)}</span>
            </p>
            <p className="text-base">
              Total compra:{" "}
              <span className="font-semibold text-primary">{formatMoneda(orden.montoTotal.toString(), orden.moneda)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
