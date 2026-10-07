import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime, formatMoneda } from "@/lib/utils";
import { MONEDAS, TIPO_CAMBIO_PEN_USD } from "@/lib/constants/moneda";
import { eliminarIngresoAlmacenAction } from "@/lib/actions/ingreso-almacen-actions";

export default async function IngresoAlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ingreso = await prisma.ingresoAlmacen.findUnique({
    where: { id },
    include: { almacen: true, proveedor: true, ordenCompra: true, items: { include: { sku: true } } },
  });
  if (!ingreso) notFound();

  const registradoPor = ingreso.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: ingreso.creadoPorId }, select: { nombres: true, apellidos: true } })
    : null;

  const moneda = ingreso.moneda as "PEN" | "USD";
  const subtotal = ingreso.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const flete = ingreso.items.reduce((acc, item) => acc + Number(item.fleteAsignado), 0);
  const total = subtotal + flete;
  const totalUsd = ingreso.items.reduce((acc, item) => acc + Number(item.subtotalUsd) + Number(item.fleteAsignadoUsd), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Ingreso ${ingreso.numero}`}
        descripcion={`${ingreso.almacen.nombre} · ${formatDateTime(ingreso.fecha)}`}
        acciones={
          <>
            {ingreso.guiaRemisionArchivo && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/almacenes/ingresos/${ingreso.id}/guia`} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar guía
                </a>
              </Button>
            )}
            {ingreso.ordenCompraId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/logistica/almacenes/ingresos/${ingreso.id}/editar`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
            )}
            <EliminarMovimientoButton
              id={ingreso.id}
              numero={ingreso.numero}
              etiqueta="el ingreso"
              accion={eliminarIngresoAlmacenAction}
              redirectTo="/logistica/almacenes/ingresos"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Proveedor</p>
          <p className="font-medium">{ingreso.proveedor?.razonSocial ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">N° de OC</p>
          {ingreso.ordenCompraId ? (
            <Link href={`/logistica/ordenes-compra/${ingreso.ordenCompraId}`} className="font-medium underline underline-offset-2">
              {ingreso.ocNumero}
            </Link>
          ) : (
            <p className="font-medium">{ingreso.ocNumero ?? "—"}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Moneda</p>
          <p className="font-medium">{MONEDAS.find((m) => m.codigo === moneda)?.nombre ?? moneda}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Guía de remisión</p>
          <p className="font-medium">{ingreso.guiaRemision ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">RUC del remitente</p>
          <p className="font-medium">{ingreso.remitenteRuc ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Nombre del remitente</p>
          <p className="font-medium">{ingreso.remitente ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Flete</p>
          <p className="font-medium">{ingreso.flete !== null ? formatMoneda(Number(ingreso.flete), moneda) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Observaciones</p>
          <p className="font-medium">{ingreso.observaciones ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Registrado por</p>
          <p className="font-medium">
            {registradoPor ? `${registradoPor.nombres} ${registradoPor.apellidos}` : "—"}
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>F. producción</TableHead>
            <TableHead>F. vencimiento</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>U.M.</TableHead>
            <TableHead className="text-right">Precio unit.</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="text-right">Flete asignado</TableHead>
            <TableHead className="text-right">Costo (US$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingreso.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell>{item.lote ?? "—"}</TableCell>
              <TableCell>{item.fechaProduccion ? formatDate(item.fechaProduccion) : "—"}</TableCell>
              <TableCell>{item.fechaVencimiento ? formatDate(item.fechaVencimiento) : "—"}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.precioUnitario), moneda)}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.subtotal), moneda)}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.fleteAsignado), moneda)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatMoneda(Number(item.subtotalUsd) + Number(item.fleteAsignadoUsd), "USD")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>
          Subtotal: <span className="font-medium">{formatMoneda(subtotal, moneda)}</span>
        </p>
        <p>
          Flete: <span className="font-medium">{formatMoneda(flete, moneda)}</span>
        </p>
        <p className="text-base">
          Total: <span className="font-semibold text-primary">{formatMoneda(total, moneda)}</span>
        </p>
        {moneda === "PEN" && (
          <p className="text-xs text-muted-foreground">
            ≈ {formatMoneda(totalUsd, "USD")} (tipo de cambio fijo S/ {TIPO_CAMBIO_PEN_USD.toFixed(2)})
          </p>
        )}
      </div>
    </div>
  );
}
