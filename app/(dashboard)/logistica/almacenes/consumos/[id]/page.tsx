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

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Consumo ${consumo.numero}`}
        descripcion={`${consumo.almacen.nombre} · ${formatDateTime(consumo.fecha)}`}
      />

      {consumo.observaciones && (
        <p className="text-sm text-muted-foreground">Observaciones: {consumo.observaciones}</p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>U.M.</TableHead>
            <TableHead className="text-right">Precio unit. ponderado (US$)</TableHead>
            <TableHead className="text-right">Valor consumido (US$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consumo.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.precioUnitarioPonderado), "USD")}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.valorConsumido), "USD")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end text-base">
        Total: <span className="ml-2 font-semibold text-primary">{formatMoneda(valorConsumido, "USD")}</span>
      </div>
    </div>
  );
}
