import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatMoneda } from "@/lib/utils";

export default async function TrasladoAlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const traslado = await prisma.trasladoAlmacen.findUnique({
    where: { id },
    include: { almacenOrigen: true, almacenDestino: true, items: { include: { sku: true } } },
  });
  if (!traslado) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Traslado ${traslado.numero}`}
        descripcion={`${traslado.almacenOrigen.nombre} → ${traslado.almacenDestino.nombre} · ${formatDateTime(traslado.fecha)}`}
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Guía de remisión</p>
          <p className="font-medium">{traslado.guiaRemision ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remitente</p>
          <p className="font-medium">{traslado.remitente ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Observaciones</p>
          <p className="font-medium">{traslado.observaciones ?? "—"}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>U.M.</TableHead>
            <TableHead className="text-right">Costo unit. ponderado</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traslado.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.costoUnitario))}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.valorTotal))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
