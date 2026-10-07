import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime, formatMoneda } from "@/lib/utils";
import { MONEDAS, TIPO_CAMBIO_PEN_USD } from "@/lib/constants/moneda";
import { eliminarTrasladoAlmacenAction } from "@/lib/actions/traslado-almacen-actions";

export default async function TrasladoAlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const traslado = await prisma.trasladoAlmacen.findUnique({
    where: { id },
    include: { almacenOrigen: true, almacenDestino: true, items: { include: { sku: true } } },
  });
  if (!traslado) notFound();

  const moneda = traslado.moneda as "PEN" | "USD";
  const valorTotal = traslado.items.reduce((acc, item) => acc + Number(item.valorTotal), 0);
  const flete = traslado.items.reduce((acc, item) => acc + Number(item.fleteAsignado), 0);
  const fleteUsd = traslado.items.reduce((acc, item) => acc + Number(item.fleteAsignadoUsd), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Traslado ${traslado.numero}`}
        descripcion={`${traslado.almacenOrigen.nombre} → ${traslado.almacenDestino.nombre} · ${formatDateTime(traslado.fecha)}`}
        acciones={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/logistica/almacenes/traslados/${traslado.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            <EliminarMovimientoButton
              id={traslado.id}
              numero={traslado.numero}
              etiqueta="el traslado"
              accion={eliminarTrasladoAlmacenAction}
              redirectTo="/logistica/almacenes/traslados"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Guía de remisión</p>
          <p className="font-medium">{traslado.guiaRemision ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">RUC del remitente</p>
          <p className="font-medium">{traslado.remitenteRuc ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Nombre del remitente</p>
          <p className="font-medium">{traslado.remitente ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Moneda del flete</p>
          <p className="font-medium">{MONEDAS.find((m) => m.codigo === moneda)?.nombre ?? moneda}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Flete</p>
          <p className="font-medium">{traslado.flete !== null ? formatMoneda(Number(traslado.flete), moneda) : "—"}</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="text-muted-foreground">Observaciones</p>
          <p className="font-medium">{traslado.observaciones ?? "—"}</p>
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
            <TableHead className="text-right">Costo unit. ponderado (US$)</TableHead>
            <TableHead className="text-right">Valor (US$)</TableHead>
            <TableHead className="text-right">Flete asignado</TableHead>
            <TableHead className="text-right">Flete (US$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traslado.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell>{item.lote ?? "—"}</TableCell>
              <TableCell>{item.fechaProduccion ? formatDate(item.fechaProduccion) : "—"}</TableCell>
              <TableCell>{item.fechaVencimiento ? formatDate(item.fechaVencimiento) : "—"}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.costoUnitario), "USD")}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.valorTotal), "USD")}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.fleteAsignado), moneda)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatMoneda(Number(item.fleteAsignadoUsd), "USD")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>
          Valor trasladado: <span className="font-medium">{formatMoneda(valorTotal, "USD")}</span>
        </p>
        <p>
          Flete: <span className="font-medium">{formatMoneda(flete, moneda)}</span>
          {moneda === "PEN" && (
            <span className="ml-1 text-xs text-muted-foreground">
              (≈ {formatMoneda(fleteUsd, "USD")}, tipo de cambio fijo S/ {TIPO_CAMBIO_PEN_USD.toFixed(2)})
            </span>
          )}
        </p>
        <p className="text-base">
          Valor con flete (costo en destino):{" "}
          <span className="font-semibold text-primary">{formatMoneda(valorTotal + fleteUsd, "USD")}</span>
        </p>
      </div>
    </div>
  );
}
