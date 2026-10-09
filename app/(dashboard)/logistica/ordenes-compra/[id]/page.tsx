import { notFound } from "next/navigation";
import Link from "next/link";
import { FileDown, Check, X as XIcon, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnularOrdenBoton, FirmarOrdenBotones } from "../aprobar-rechazar-botones";
import { SeguimientoOrdenDialog, type ItemSeguimientoOrden } from "./seguimiento-orden-dialog";
import type { ResumenSolped } from "@/components/shared/resumen-solped-dialog";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime, formatMoneda, formatCantidad } from "@/lib/utils";
import {
  AREAS_EMPRESA,
  CATEGORIAS_COMPRA,
  IGV_TASA,
  NOMBRE_ORDEN,
  ROLES_APROBADOR_ESPECIAL,
  type CategoriaCompraCodigo,
} from "@/lib/constants/compras";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresEspeciales } from "@/lib/compras";
import type { EstadoDocumento, EstadoFirma } from "@prisma/client";

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

const ESTADO_FIRMA_VARIANT: Record<EstadoFirma, "success" | "destructive" | "secondary"> = {
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
};

const ESTADO_FIRMA_LABEL: Record<EstadoFirma, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

function nombreArea(valor: string) {
  return AREAS_EMPRESA.find((a) => a.valor === valor)?.nombre ?? valor;
}

function nombreRolEspecial(valor: string) {
  return ROLES_APROBADOR_ESPECIAL.find((r) => r.valor === valor)?.nombre ?? valor;
}

export default async function OrdenCompraDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: {
        include: {
          sku: true,
          solicitudPedidoItem: { include: { solicitudPedido: true } },
          ingresosAlmacenItem: { include: { ingresoAlmacen: true } },
        },
      },
      firmas: true,
    },
  });

  if (!orden) notFound();

  const idsFirmantes = orden.firmas.map((f) => f.usuarioId).filter((v): v is string => !!v);

  const [usuario, aprobador, creador, aprobadoresEspeciales, usuariosFirmantes] = await Promise.all([
    getUsuarioActual(),
    orden.aprobadoPorId ? prisma.usuario.findUnique({ where: { id: orden.aprobadoPorId } }) : null,
    orden.creadoPorId ? prisma.usuario.findUnique({ where: { id: orden.creadoPorId } }) : null,
    obtenerAprobadoresEspeciales(),
    idsFirmantes.length > 0 ? prisma.usuario.findMany({ where: { id: { in: idsFirmantes } } }) : Promise.resolve([]),
  ]);
  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;
  const aprobadorPorRolEspecial = new Map(aprobadoresEspeciales.map((a) => [a.rol, a.usuarioId]));
  const usuarioFirmantePorId = new Map(usuariosFirmantes.map((u) => [u.id, u]));

  // Anular es exclusivo de quien tenga el rol ANULADOR, sin importar el
  // estado de la orden.
  const puedeAnular =
    (usuario?.roles.includes("ANULADOR") ?? false) && orden.estado !== "RECHAZADO" && orden.estado !== "ANULADO";
  const esServicio = orden.categoria === "SERVICIO";

  // Firma(s) que el usuario actual puede resolver ahora mismo: la de su
  // propio rol especial si está pendiente, o — si es ADMIN y no tiene un
  // rol propio pendiente — la primera pendiente, como respaldo.
  const firmasPendientes = orden.firmas.filter((f) => f.estado === "PENDIENTE");
  const firmaPropiaId = usuario ? firmasPendientes.find((f) => aprobadorPorRolEspecial.get(f.rol) === usuario.id)?.id : undefined;
  const firmaQuePuedeUsar =
    orden.estado === "PENDIENTE"
      ? (firmaPropiaId ?? (esAdmin && firmasPendientes.length > 0 ? firmasPendientes[0].id : undefined))
      : undefined;

  // Para el seguimiento: por cada línea, de qué solicitud vino y cuánto ya
  // se recibió en almacén (y con qué guía de remisión) — una línea puede
  // recibirse en más de un ingreso.
  const itemsSeguimiento: ItemSeguimientoOrden[] = orden.items.map((item) => {
    const cantidadRecibida = item.ingresosAlmacenItem.reduce((acc, ing) => acc + Number(ing.cantidad), 0);
    const guiasRemision = [
      ...new Set(item.ingresosAlmacenItem.map((ing) => ing.ingresoAlmacen.guiaRemision).filter((g): g is string => !!g)),
    ];
    return {
      id: item.id,
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      descripcionServicio: item.descripcion,
      unidadMedida: item.sku.unidadMedida,
      cantidad: Number(item.cantidad),
      solicitud: item.solicitudPedidoItem
        ? { id: item.solicitudPedidoItem.solicitudPedidoId, numero: item.solicitudPedidoItem.solicitudPedido.numero }
        : null,
      guiasRemision,
      cantidadRecibida,
    };
  });

  // Para el "Ir a vista Solped" del seguimiento sin salir de esta pantalla:
  // un resumen (con su propia lista completa de productos) de cada
  // solicitud distinta referenciada por algún item de esta OC.
  const solpedIds = [...new Set(itemsSeguimiento.map((i) => i.solicitud?.id).filter((v): v is string => !!v))];
  const solicitudesReferenciadas =
    solpedIds.length > 0
      ? await prisma.solicitudPedido.findMany({
          where: { id: { in: solpedIds } },
          include: { items: { include: { sku: true } } },
        })
      : [];
  const resumenesSolpeds: Record<string, ResumenSolped> = {};
  for (const sp of solicitudesReferenciadas) {
    resumenesSolpeds[sp.id] = {
      id: sp.id,
      numero: sp.numero,
      categoriaLabel: CATEGORIAS_COMPRA.find((c) => c.valor === sp.categoria)?.nombre ?? sp.categoria,
      esServicio: sp.categoria === "SERVICIO",
      area: nombreArea(sp.area),
      fecha: formatDate(sp.fecha),
      estadoLabel: ESTADO_LABEL[sp.estado],
      items: sp.items.map((item) => ({
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        descripcionServicio: item.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: Number(item.cantidad),
      })),
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`${NOMBRE_ORDEN[orden.categoria as CategoriaCompraCodigo]} ${orden.numero}`}
        descripcion={`${orden.proveedor.razonSocial} · ${formatDate(orden.fecha)}`}
        acciones={
          <div className="flex gap-2">
            {firmaQuePuedeUsar && (
              <FirmarOrdenBotones
                id={orden.id}
                numero={orden.numero}
                rolLabel={nombreRolEspecial(orden.firmas.find((f) => f.id === firmaQuePuedeUsar)!.rol)}
              />
            )}
            {puedeAnular && (
              <AnularOrdenBoton id={orden.id} numero={orden.numero} redirectTo="/logistica/ordenes-compra" />
            )}
            <Button variant="outline" asChild>
              <a href={`/api/pdf/orden-compra/${orden.id}`} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
            <SeguimientoOrdenDialog
              numero={orden.numero}
              fecha={formatDate(orden.fecha)}
              responsable={creador ? `${creador.nombres} ${creador.apellidos}` : "—"}
              fechaCreacion={formatDateTime(orden.createdAt)}
              fechaAprobacion={orden.fechaAprobacion ? formatDateTime(orden.fechaAprobacion) : null}
              aprobadoPor={aprobador ? `${aprobador.nombres} ${aprobador.apellidos}` : null}
              esServicio={esServicio}
              items={itemsSeguimiento}
              resumenesSolpeds={resumenesSolpeds}
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
            <p className="text-muted-foreground">Estatus</p>
            <Badge variant={ESTADO_VARIANT[orden.estado]}>{ESTADO_LABEL[orden.estado]}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Categoría</p>
            <p className="font-medium">
              {CATEGORIAS_COMPRA.find((c) => c.valor === orden.categoria)?.nombre ?? orden.categoria}
            </p>
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
          {orden.fechaEntrega && (
            <div>
              <p className="text-muted-foreground">Fecha de entrega</p>
              <p className="font-medium">{formatDate(orden.fechaEntrega)}</p>
            </div>
          )}
          {orden.condicionPago && (
            <div>
              <p className="text-muted-foreground">Condición de pago</p>
              <p className="font-medium">{orden.condicionPago}</p>
            </div>
          )}
          {orden.lugarEntrega && (
            <div>
              <p className="text-muted-foreground">Lugar de entrega</p>
              <p className="font-medium">{orden.lugarEntrega}</p>
            </div>
          )}
          {orden.observaciones && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-muted-foreground">Observaciones</p>
              <p className="font-medium">{orden.observaciones}</p>
            </div>
          )}
          {aprobador && orden.fechaAprobacion && (
            <div>
              <p className="text-muted-foreground">
                {orden.estado === "RECHAZADO" ? "Rechazada por" : orden.estado === "ANULADO" ? "Anulada por" : "Aprobada por"}
              </p>
              <p className="font-medium">
                {aprobador.nombres} {aprobador.apellidos}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(orden.fechaAprobacion)}</p>
            </div>
          )}
          {orden.comentarioRechazo && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-muted-foreground">{orden.estado === "ANULADO" ? "Motivo de la anulación" : "Motivo del rechazo"}</p>
              <p className="font-medium">{orden.comentarioRechazo}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {orden.firmas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprobaciones requeridas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Según el monto de la orden{orden.firmas.some((f) => f.rol === "GERENTE_RRHH") ? " y sus ítems de RRHH" : ""},
              necesita la firma de estos roles antes de quedar aprobada.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {orden.firmas.map((firma) => {
              const firmante = firma.usuarioId ? usuarioFirmantePorId.get(firma.usuarioId) : null;
              return (
                <div key={firma.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    {firma.estado === "PENDIENTE" ? (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    ) : firma.estado === "APROBADO" ? (
                      <Check className="h-4 w-4 text-green-700" />
                    ) : (
                      <XIcon className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{nombreRolEspecial(firma.rol)}</p>
                      {firmante ? (
                        <p className="text-xs text-muted-foreground">
                          {firmante.nombres} {firmante.apellidos}
                          {firma.fecha ? ` · ${formatDateTime(firma.fecha)}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin resolver</p>
                      )}
                      {firma.comentario && <p className="text-xs text-muted-foreground">&quot;{firma.comentario}&quot;</p>}
                    </div>
                  </div>
                  <Badge variant={ESTADO_FIRMA_VARIANT[firma.estado]}>{ESTADO_FIRMA_LABEL[firma.estado]}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
                  {esServicio && <TableHead className="min-w-[220px]">Descripción del servicio</TableHead>}
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
                    {esServicio && (
                      <TableCell className="max-w-xs whitespace-pre-wrap">{item.descripcion || "—"}</TableCell>
                    )}
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
                      {formatCantidad(Number(item.cantidad))} {item.sku.unidadMedida}
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
