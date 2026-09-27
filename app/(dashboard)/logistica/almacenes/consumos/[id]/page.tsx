import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatMoneda } from "@/lib/utils";

export default async function ConsumoAlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consumo = await prisma.consumoAlmacen.findUnique({
    where: { id },
    include: { almacen: true, items: { include: { sku: true } } },
  });
  if (!consumo) notFound();

  const valorConsumido = consumo.items.reduce((acc, item) => acc + Number(item.valorConsumido), 0);
  const flete = consumo.items.reduce((acc, item) => acc + Number(item.fleteAsignado), 0);

  const hayDatosTransporte = consumo.guiaRemision || consumo.remitenteRuc || consumo.remitente || consumo.flete !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Consumo ${consumo.numero}`}
        descripcion={`${consumo.almacen.nombre} · ${formatDateTime(consumo.fecha)}`}
      />

      {consumo.observaciones && (
        <p className="text-sm text-muted-foreground">Observaciones: {consumo.observaciones}</p>
      )}

      {hayDatosTransporte && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Guía de remisión</p>
            <p className="font-medium">{consumo.guiaRemision ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">RUC del remitente</p>
            <p className="font-medium">{consumo.remitenteRuc ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Nombre del remitente</p>
            <p className="font-medium">{consumo.remitente ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Flete</p>
            <p className="font-medium">{consumo.flete !== null ? formatMoneda(Number(consumo.flete)) : "—"}</p>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>U.M.</TableHead>
            <TableHead className="text-right">Precio unit. ponderado</TableHead>
            <TableHead className="text-right">Valor consumido</TableHead>
            <TableHead className="text-right">Flete asignado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consumo.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.precioUnitarioPonderado))}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.valorConsumido))}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.fleteAsignado))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>
          Valor consumido: <span className="font-medium">{formatMoneda(valorConsumido)}</span>
        </p>
        <p>
          Flete: <span className="font-medium">{formatMoneda(flete)}</span>
        </p>
        <p className="text-base">
          Total: <span className="font-semibold text-primary">{formatMoneda(valorConsumido + flete)}</span>
        </p>
      </div>
    </div>
  );
}
