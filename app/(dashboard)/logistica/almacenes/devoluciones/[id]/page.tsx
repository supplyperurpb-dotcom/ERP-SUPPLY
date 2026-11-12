import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime, formatMoneda } from "@/lib/utils";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { eliminarDevolucionAlmacenAction } from "@/lib/actions/devolucion-almacen-actions";

export default async function DevolucionAlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const devolucion = await prisma.devolucionAlmacen.findUnique({
    where: { id },
    include: { almacen: true, proveedor: true, items: { include: { sku: true } } },
  });
  if (!devolucion) notFound();

  const registradoPor = devolucion.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: devolucion.creadoPorId }, select: { nombres: true, apellidos: true } })
    : null;

  const total = devolucion.items.reduce((acc, item) => acc + Number(item.subtotal), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Devolución ${devolucion.numero}`}
        descripcion={formatDateTime(devolucion.fecha)}
        acciones={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/logistica/almacenes/devoluciones/${devolucion.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            <EliminarMovimientoButton
              id={devolucion.id}
              numero={devolucion.numero}
              etiqueta="la devolución"
              accion={eliminarDevolucionAlmacenAction}
              redirectTo="/logistica/almacenes/devoluciones"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Tipo de movimiento</p>
          <p className="font-medium">Devolución</p>
        </div>
        <div>
          <p className="text-muted-foreground">Código del movimiento</p>
          <p className="font-medium">{devolucion.numero}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Almacén</p>
          <p className="font-medium">
            {devolucion.almacen.nombre} <span className="font-mono text-muted-foreground">({devolucion.almacen.codigo})</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Área</p>
          <p className="font-medium">{AREAS_EMPRESA.find((a) => a.valor === devolucion.area)?.nombre ?? devolucion.area}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Quien trae el material</p>
          <p className="font-medium">
            {devolucion.personaQueTrae} — DNI {devolucion.personaQueTraeDni}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Proveedor</p>
          <p className="font-medium">{devolucion.proveedor?.razonSocial ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Registrado por</p>
          <p className="font-medium">{registradoPor ? `${registradoPor.nombres} ${registradoPor.apellidos}` : "—"}</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="text-muted-foreground">Observaciones</p>
          <p className="font-medium">{devolucion.observaciones ?? "—"}</p>
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
            <TableHead className="text-right">Precio (US$)</TableHead>
            <TableHead className="text-right">Subtotal (US$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devolucion.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.sku.codigo}</TableCell>
              <TableCell>{item.sku.descripcion}</TableCell>
              <TableCell>{item.lote ?? "—"}</TableCell>
              <TableCell>{item.fechaProduccion ? formatDate(item.fechaProduccion) : "—"}</TableCell>
              <TableCell>{item.fechaVencimiento ? formatDate(item.fechaVencimiento) : "—"}</TableCell>
              <TableCell className="text-right">{Number(item.cantidad).toLocaleString("es-PE")}</TableCell>
              <TableCell>{item.unidadMedida}</TableCell>
              <TableCell className="text-right">
                {item.noValorado ? <Badge variant="secondary">No valorado</Badge> : formatMoneda(Number(item.precioUnitario), "USD")}
              </TableCell>
              <TableCell className="text-right">{formatMoneda(Number(item.subtotal), "USD")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end text-sm">
        <p className="text-base">
          Total: <span className="font-semibold text-primary">{formatMoneda(total, "USD")}</span>
        </p>
      </div>
    </div>
  );
}
