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
import { formatDate } from "@/lib/utils";
import { eliminarSolicitudTrasladoAction } from "@/lib/actions/solicitud-traslado-actions";
import type { EstadoSolicitudTraslado } from "../solicitudes-traslado-table";

const ESTADO_LABEL: Record<EstadoSolicitudTraslado, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  EJECUTADA: "Ejecutada",
};

const ESTADO_VARIANT: Record<EstadoSolicitudTraslado, "success" | "secondary"> = {
  PENDIENTE: "secondary",
  PARCIAL: "secondary",
  EJECUTADA: "success",
};

export default async function SolicitudTrasladoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const solicitud = await prisma.solicitudTraslado.findUnique({
    where: { id },
    include: {
      almacenOrigen: true,
      almacenDestino: true,
      items: { include: { sku: true, trasladoAlmacenItems: { include: { trasladoAlmacen: true } } } },
    },
  });
  if (!solicitud) notFound();

  const solicitante = solicitud.solicitanteId
    ? await prisma.usuario.findUnique({ where: { id: solicitud.solicitanteId } })
    : null;

  const totalSolicitado = solicitud.items.reduce((acc, item) => acc + Number(item.cantidad), 0);
  const totalMovido = solicitud.items.reduce(
    (acc, item) => acc + item.trasladoAlmacenItems.reduce((a, t) => a + Number(t.cantidad), 0),
    0
  );
  const estado: EstadoSolicitudTraslado = totalMovido <= 0 ? "PENDIENTE" : totalMovido >= totalSolicitado ? "EJECUTADA" : "PARCIAL";
  const puedeEliminar = totalMovido <= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Solicitud de traslado ${solicitud.numero}`}
        descripcion={`${solicitud.almacenOrigen.nombre} → ${solicitud.almacenDestino.nombre} · ${formatDate(solicitud.fecha)}`}
        acciones={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={`/api/pdf/solicitud-traslado/${solicitud.id}`} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            {puedeEliminar && (
              <EliminarMovimientoButton
                id={solicitud.id}
                numero={solicitud.numero}
                etiqueta="la solicitud de traslado"
                accion={eliminarSolicitudTrasladoAction}
                redirectTo="/logistica/solicitudes-traslado"
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
            <p className="text-muted-foreground">Almacén origen</p>
            <p className="font-medium">{solicitud.almacenOrigen.nombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Almacén destino</p>
            <p className="font-medium">{solicitud.almacenDestino.nombre}</p>
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
                  <TableHead className="text-right">Movido</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Traslados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitud.items.map((item) => {
                  const cantidad = Number(item.cantidad);
                  const movido = item.trasladoAlmacenItems.reduce((acc, t) => acc + Number(t.cantidad), 0);
                  const pendiente = Math.round((cantidad - movido) * 1000) / 1000;
                  const traslados = [...new Map(item.trasladoAlmacenItems.map((t) => [t.trasladoAlmacen.id, t.trasladoAlmacen])).values()];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.sku.codigo}</TableCell>
                      <TableCell>{item.sku.descripcion}</TableCell>
                      <TableCell className="text-right">
                        {cantidad} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right">
                        {movido} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {pendiente} {item.unidadMedida}
                      </TableCell>
                      <TableCell>
                        {traslados.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {traslados.map((t) => (
                              <Link
                                key={t.id}
                                href={`/logistica/almacenes/traslados/${t.id}`}
                                className="underline underline-offset-2"
                              >
                                {t.numero}
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
