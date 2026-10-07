import { notFound } from "next/navigation";
import Link from "next/link";
import { FileDown, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AprobarRechazarBotones, AnularSolicitudBoton } from "../aprobar-rechazar-botones";
import { SeguimientoPedidoDialog, type ItemSeguimientoPedido } from "./seguimiento-pedido-dialog";
import type { ResumenOrden } from "@/components/shared/resumen-orden-dialog";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA, NOMBRE_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea, puedeAprobarSolicitud } from "@/lib/compras";
import type { EstadoDocumento } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ANULADO: "Anulada",
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
          ordenCompraItems: {
            include: {
              ordenCompra: true,
              ingresosAlmacenItem: { include: { ingresoAlmacen: true } },
            },
          },
        },
      },
    },
  });

  if (!solicitud) notFound();

  const [usuario, aprobadores, aprobador, solicitante] = await Promise.all([
    getUsuarioActual(),
    obtenerAprobadoresArea(),
    solicitud.aprobadoPorId ? prisma.usuario.findUnique({ where: { id: solicitud.aprobadoPorId } }) : null,
    solicitud.solicitanteId ? prisma.usuario.findUnique({ where: { id: solicitud.solicitanteId } }) : null,
  ]);
  const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));
  const tienePermisoArea =
    !!usuario &&
    puedeAprobarSolicitud({ usuarioId: usuario.id, roles: usuario.roles, area: solicitud.area, aprobadoresPorArea });
  const puedeAprobar = solicitud.estado === "PENDIENTE" && tienePermisoArea;
  // Anular es exclusivo de quien tenga el rol ANULADOR, sin importar el
  // estado de la solicitud.
  const puedeAnular =
    (usuario?.roles.includes("ANULADOR") ?? false) &&
    solicitud.estado !== "RECHAZADO" &&
    solicitud.estado !== "ANULADO";
  // Los compradores de Supply Chain generan las OC/OS para toda la empresa.
  const puedeGenerarOrden = (usuario?.roles.includes("ADMIN") ?? false) || usuario?.area === "SUPPLY_CHAIN";
  const tienePendiente = solicitud.items.some((item) => {
    const jalado = item.ordenCompraItems
      .filter((oci) => oci.ordenCompra.estado !== "RECHAZADO" && oci.ordenCompra.estado !== "ANULADO")
      .reduce((acc, oci) => acc + Number(oci.cantidad), 0);
    return Number(item.cantidad) - jalado > 0;
  });

  // Para el seguimiento: por cada línea, cuánto ya se recibió en almacén (a
  // través de las OC activas que jalaron de ella) y con qué guía(s) de
  // remisión — una línea puede recibirse en más de un ingreso.
  const itemsSeguimiento: ItemSeguimientoPedido[] = solicitud.items.map((item) => {
    const ocsActivas = item.ordenCompraItems.filter(
      (oci) => oci.ordenCompra.estado !== "RECHAZADO" && oci.ordenCompra.estado !== "ANULADO"
    );
    const cantidadConOc = ocsActivas.reduce((acc, oci) => acc + Number(oci.cantidad), 0);
    const ingresos = ocsActivas.flatMap((oci) => oci.ingresosAlmacenItem);
    const cantidadRecibida = ingresos.reduce((acc, ing) => acc + Number(ing.cantidad), 0);
    const guiasRemision = [...new Set(ingresos.map((ing) => ing.ingresoAlmacen.guiaRemision).filter((g): g is string => !!g))];
    const ordenes = ocsActivas.map((oci) => ({ id: oci.ordenCompra.id, numero: oci.ordenCompra.numero }));
    return {
      id: item.id,
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      descripcionServicio: item.descripcion,
      unidadMedida: item.unidadMedida,
      cantidad: Number(item.cantidad),
      cantidadConOc,
      ordenes,
      guiasRemision,
      cantidadRecibida,
    };
  });

  // Para el "Ir a vista OC" del seguimiento sin salir de esta pantalla: un
  // resumen (con su propia lista completa de productos) de cada OC distinta
  // referenciada por algún item de esta solicitud.
  const ocIds = [...new Set(itemsSeguimiento.flatMap((i) => i.ordenes.map((o) => o.id)))];
  const ordenesReferenciadas =
    ocIds.length > 0
      ? await prisma.ordenCompra.findMany({
          where: { id: { in: ocIds } },
          include: { proveedor: true, items: { include: { sku: true } } },
        })
      : [];
  const resumenesOrdenes: Record<string, ResumenOrden> = {};
  for (const oc of ordenesReferenciadas) {
    resumenesOrdenes[oc.id] = {
      id: oc.id,
      numero: oc.numero,
      esServicio: oc.categoria === "SERVICIO",
      proveedor: oc.proveedor.razonSocial,
      fecha: formatDate(oc.fecha),
      estadoLabel: ESTADO_LABEL[oc.estado],
      moneda: oc.moneda,
      items: oc.items.map((item) => ({
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        descripcionServicio: item.descripcion,
        unidadMedida: item.sku.unidadMedida,
        cantidad: Number(item.cantidad),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`${NOMBRE_SOLICITUD[solicitud.categoria as CategoriaCompraCodigo]} ${solicitud.numero}`}
        descripcion={`${nombreArea(solicitud.area)} · ${formatDate(solicitud.fecha)}`}
        acciones={
          <div className="flex gap-2">
            {puedeAprobar && <AprobarRechazarBotones id={solicitud.id} numero={solicitud.numero} />}
            {puedeAnular && (
              <AnularSolicitudBoton id={solicitud.id} numero={solicitud.numero} redirectTo="/logistica/solicitudes-pedido" />
            )}
            <Button variant="outline" asChild>
              <a href={`/api/pdf/solicitud-pedido/${solicitud.id}`} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            <SeguimientoPedidoDialog
              numero={solicitud.numero}
              fecha={formatDate(solicitud.fecha)}
              responsable={solicitante ? `${solicitante.nombres} ${solicitante.apellidos}` : "—"}
              fechaCreacion={formatDateTime(solicitud.createdAt)}
              fechaAprobacion={solicitud.fechaAprobacion ? formatDateTime(solicitud.fechaAprobacion) : null}
              aprobadoPor={aprobador ? `${aprobador.nombres} ${aprobador.apellidos}` : null}
              esServicio={solicitud.categoria === "SERVICIO"}
              items={itemsSeguimiento}
              resumenesOrdenes={resumenesOrdenes}
            />
            {puedeGenerarOrden &&
              solicitud.estado === "APROBADO" &&
              (tienePendiente ? (
                <Button asChild>
                  <Link
                    href={`/logistica/ordenes-compra/nuevo?categoria=${solicitud.categoria}&solicitudId=${solicitud.id}`}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Generar {solicitud.categoria === "SERVICIO" ? "OS" : "OC"}
                  </Link>
                </Button>
              ) : (
                <Button disabled title="Ya no quedan ítems pendientes de esta solicitud para jalar a una orden">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Generar {solicitud.categoria === "SERVICIO" ? "OS" : "OC"}
                </Button>
              ))}
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
              <p className="text-muted-foreground">
                {solicitud.estado === "RECHAZADO" ? "Rechazada por" : solicitud.estado === "ANULADO" ? "Anulada por" : "Aprobada por"}
              </p>
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
              <p className="text-muted-foreground">{solicitud.estado === "ANULADO" ? "Motivo de la anulación" : "Motivo del rechazo"}</p>
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
                  {solicitud.categoria === "SERVICIO" && <TableHead>Descripción del servicio</TableHead>}
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Con OC</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Centro de costo</TableHead>
                  <TableHead>Campo</TableHead>
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
                      {solicitud.categoria === "SERVICIO" && (
                        <TableCell className="max-w-xs whitespace-pre-wrap">{item.descripcion || "—"}</TableCell>
                      )}
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
                      <TableCell>{item.campo || "—"}</TableCell>
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
