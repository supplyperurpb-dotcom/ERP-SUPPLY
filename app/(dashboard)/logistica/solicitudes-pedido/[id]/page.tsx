import { notFound } from "next/navigation";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { AprobarRechazarBotones } from "../aprobar-rechazar-botones";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA, NOMBRE_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { eliminarSolicitudPedidoAction } from "@/lib/actions/solicitud-pedido-actions";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea, puedeAprobarSolicitud } from "@/lib/compras";
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

export default async function SolicitudPedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const solicitud = await prisma.solicitudPedido.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          sku: true,
          ordenCompraItems: { include: { ordenCompra: true } },
        },
      },
    },
  });

  if (!solicitud) notFound();

  const [usuario, aprobadores, aprobador] = await Promise.all([
    getUsuarioActual(),
    obtenerAprobadoresArea(),
    solicitud.aprobadoPorId ? prisma.usuario.findUnique({ where: { id: solicitud.aprobadoPorId } }) : null,
  ]);
  const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));
  const puedeAprobar =
    solicitud.estado === "PENDIENTE" &&
    !!usuario &&
    puedeAprobarSolicitud({ usuarioId: usuario.id, roles: usuario.roles, area: solicitud.area, aprobadoresPorArea });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`${NOMBRE_SOLICITUD[solicitud.categoria as CategoriaCompraCodigo]} ${solicitud.numero}`}
        descripcion={`${nombreArea(solicitud.area)} · ${formatDate(solicitud.fecha)}`}
        acciones={
          <div className="flex gap-2">
            {puedeAprobar && <AprobarRechazarBotones id={solicitud.id} numero={solicitud.numero} />}
            <Button variant="outline" asChild>
              <a href={`/api/pdf/solicitud-pedido/${solicitud.id}`} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            <EliminarMovimientoButton
              id={solicitud.id}
              numero={solicitud.numero}
              etiqueta="la solicitud"
              accion={eliminarSolicitudPedidoAction}
              redirectTo="/logistica/solicitudes-pedido"
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
            <Badge variant={ESTADO_VARIANT[solicitud.estado]}>{ESTADO_LABEL[solicitud.estado]}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Categoría</p>
            <p className="font-medium">
              {CATEGORIAS_COMPRA.find((c) => c.valor === solicitud.categoria)?.nombre ?? solicitud.categoria}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Área</p>
            <p className="font-medium">{nombreArea(solicitud.area)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de pedido</p>
            <p className="font-medium">{formatDate(solicitud.fecha)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha estimada de necesidad</p>
            <p className="font-medium">{formatDate(solicitud.fechaNecesidad)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tipo de necesidad</p>
            <p className="font-medium">
              {TIPOS_NECESIDAD.find((t) => t.valor === solicitud.tipoNecesidad)?.nombre ?? solicitud.tipoNecesidad}
            </p>
          </div>
          {aprobador && solicitud.fechaAprobacion && (
            <div>
              <p className="text-muted-foreground">{solicitud.estado === "RECHAZADO" ? "Rechazado por" : "Aprobado por"}</p>
              <p className="font-medium">
                {aprobador.nombres} {aprobador.apellidos}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(solicitud.fechaAprobacion)}</p>
            </div>
          )}
          {solicitud.justificacion && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-muted-foreground">Justificación</p>
              <p className="font-medium">{solicitud.justificacion}</p>
            </div>
          )}
          {solicitud.comentarioRechazo && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-muted-foreground">Motivo del rechazo</p>
              <p className="font-medium">{solicitud.comentarioRechazo}</p>
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
                  <TableHead className="text-right">Jalado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Centro de costo</TableHead>
                  <TableHead>Órdenes de compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitud.items.map((item) => {
                  const cantidad = Number(item.cantidad);
                  const ocsActivas = item.ordenCompraItems.filter(
                    (oci) => oci.ordenCompra.estado !== "RECHAZADO" && oci.ordenCompra.estado !== "ANULADO"
                  );
                  const jalado = ocsActivas.reduce((acc, oci) => acc + Number(oci.cantidad), 0);
                  const pendiente = Math.round((cantidad - jalado) * 1000) / 1000;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.sku.codigo}</TableCell>
                      <TableCell>{item.sku.descripcion}</TableCell>
                      <TableCell className="text-right">
                        {cantidad} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right">
                        {jalado} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {pendiente} {item.unidadMedida}
                      </TableCell>
                      <TableCell>{nombreArea(item.centroCosto)}</TableCell>
                      <TableCell>
                        {ocsActivas.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ocsActivas.map((oci) => (
                              <Link
                                key={oci.id}
                                href={`/logistica/ordenes-compra/${oci.ordenCompra.id}`}
                                className="underline underline-offset-2"
                              >
                                {oci.ordenCompra.numero}
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
