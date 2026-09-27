import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatMoneda } from "@/lib/utils";

export default async function IngresoAlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ingreso = await prisma.ingresoAlmacen.findUnique({
    where: { id },
    include: { almacen: true, proveedor: true, items: { include: { sku: true } } },
  });
  if (!ingreso) notFound();

  const subtotal = ingreso.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const flete = ingreso.items.reduce((acc, item) => acc + Number(item.fleteAsignado), 0);
  const total = subtotal + flete;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Ingreso ${ingreso.numero}`}
        descripcion={`${ingreso.almacen.nombre} · ${formatDateTime(ingreso.fecha)}`}
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Proveedor</p>
          <p className="font-medium">{ingreso.proveedor?.razonSocial ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">N° de OC</p>
          <p className="font-medium">{ingreso.ocNumero ?? "—"}</p>
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
          <p className="font-medium">{ingreso.flete !== null ? formatMoneda(Number(ingreso.flete)) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Observaciones</p>
          <p className="font-medium">{ingreso.observaciones ?? "—"}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>U.M.</TableHead>
            <TableHead className="text-right">Precio unit.</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="text-right">Flete asignado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingreso.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell>{item.lote ?? "—"}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.precioUnitario))}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.subtotal))}</TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.fleteAsignado))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p>
          Subtotal: <span className="font-medium">{formatMoneda(subtotal)}</span>
        </p>
        <p>
          Flete: <span className="font-medium">{formatMoneda(flete)}</span>
        </p>
        <p className="text-base">
          Total: <span className="font-semibold text-primary">{formatMoneda(total)}</span>
        </p>
      </div>
    </div>
  );
}
