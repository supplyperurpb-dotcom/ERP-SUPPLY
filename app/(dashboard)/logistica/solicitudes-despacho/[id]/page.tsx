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
import { formatDate, formatCantidad } from "@/lib/utils";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { eliminarSolicitudDespachoAction } from "@/lib/actions/solicitud-despacho-actions";
import type { EstadoSolicitudDespacho } from "../solicitudes-despacho-table";

const ESTADO_LABEL: Record<EstadoSolicitudDespacho, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  ATENDIDA: "Atendida",
};

const ESTADO_VARIANT: Record<EstadoSolicitudDespacho, "success" | "secondary"> = {
  PENDIENTE: "secondary",
  PARCIAL: "secondary",
  ATENDIDA: "success",
};

export default async function SolicitudDespachoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const solicitud = await prisma.solicitudDespacho.findUnique({
    where: { id },
    include: {
      items: { include: { sku: true, consumoAlmacenItems: { include: { consumoAlmacen: true } } } },
    },
  });
  if (!solicitud) notFound();

  const solicitante = solicitud.solicitanteId
    ? await prisma.usuario.findUnique({ where: { id: solicitud.solicitanteId } })
    : null;

  const totalSolicitado = solicitud.items.reduce((acc, item) => acc + Number(item.cantidad), 0);
  const totalAtendido = solicitud.items.reduce(
    (acc, item) => acc + item.consumoAlmacenItems.reduce((a, c) => a + Number(c.cantidad), 0),
    0
  );
  const estado: EstadoSolicitudDespacho = totalAtendido <= 0 ? "PENDIENTE" : totalAtendido >= totalSolicitado ? "ATENDIDA" : "PARCIAL";
  const puedeEliminar = totalAtendido <= 0;
  const areaNombre = AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Solicitud de despacho ${solicitud.numero}`}
        descripcion={`${areaNombre} · ${formatDate(solicitud.fecha)}`}
        acciones={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={`/api/pdf/solicitud-despacho/${solicitud.id}`} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            {estado !== "ATENDIDA" && (
              <Button variant="outline" asChild>
                <Link href={`/logistica/almacenes/consumos/nuevo?solicitudDespachoId=${solicitud.id}`}>Atender en Almacén</Link>
              </Button>
            )}
            {puedeEliminar && (
              <EliminarMovimientoButton
                id={solicitud.id}
                numero={solicitud.numero}
                etiqueta="la solicitud de despacho"
                accion={eliminarSolicitudDespachoAction}
                redirectTo="/logistica/solicitudes-despacho"
              />
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Estatus</p>
            <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_LABEL[estado]}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Área</p>
            <p className="font-medium">{areaNombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha</p>
            <p className="font-medium">{formatDate(solicitud.fecha)}</p>
          </div>
          {solicitante && (
            <div>
              <p className="text-muted-foreground">Solicitante</p>
              <p className="font-medium">
                {solicitante.nombres} {solicitante.apellidos}
              </p>
            </div>
          )}
          {solicitud.observaciones && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-muted-foreground">Observaciones</p>
              <p className="font-medium">{solicitud.observaciones}</p>
            </div>
          )}
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
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Atendido</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Centro de costo</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Consumos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitud.items.map((item) => {
                  const cantidad = Number(item.cantidad);
                  const atendido = item.consumoAlmacenItems.reduce((acc, c) => acc + Number(c.cantidad), 0);
                  const pendiente = Math.round((cantidad - atendido) * 1000) / 1000;
                  const consumos = [...new Map(item.consumoAlmacenItems.map((c) => [c.consumoAlmacen.id, c.consumoAlmacen])).values()];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.sku.codigo}</TableCell>
                      <TableCell>{item.sku.descripcion}</TableCell>
                      <TableCell className="text-right">
                        {formatCantidad(cantidad)} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCantidad(atendido)} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCantidad(pendiente)} {item.unidadMedida}
                      </TableCell>
                      <TableCell>{item.centroCosto}</TableCell>
                      <TableCell>{item.campo ?? "—"}</TableCell>
                      <TableCell>
                        {consumos.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {consumos.map((c) => (
                              <Link
                                key={c.id}
                                href={`/logistica/almacenes/consumos/${c.id}`}
                                className="underline underline-offset-2"
                              >
                                {c.numero}
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
