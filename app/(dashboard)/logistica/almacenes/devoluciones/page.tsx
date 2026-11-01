import Link from "next/link";
import { Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { eliminarDevolucionAlmacenAction } from "@/lib/actions/devolucion-almacen-actions";

export default async function DevolucionesAlmacenPage() {
  const devoluciones = await prisma.devolucionAlmacen.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { almacen: true, proveedor: true, _count: { select: { items: true } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Devoluciones a almacén"
        descripcion="Material que un área había retirado y no usó, y ahora regresa al almacén."
        acciones={
          <Button asChild>
            <Link href="/logistica/almacenes/devoluciones/nuevo">
              <Undo2 className="mr-2 h-4 w-4" />
              Nueva devolución
            </Link>
          </Button>
        }
      />

      {devoluciones.length === 0 ? (
        <EmptyState
          icono={Undo2}
          titulo="Aún no hay devoluciones registradas"
          descripcion="Registra la primera devolución con el botón 'Nueva devolución' de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Quien trae</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devoluciones.map((devolucion) => (
              <TableRow key={devolucion.id}>
                <TableCell className="font-medium">{devolucion.numero}</TableCell>
                <TableCell>{formatDateTime(devolucion.fecha)}</TableCell>
                <TableCell>{devolucion.almacen.nombre}</TableCell>
                <TableCell>{AREAS_EMPRESA.find((a) => a.valor === devolucion.area)?.nombre ?? devolucion.area}</TableCell>
                <TableCell>{devolucion.personaQueTrae}</TableCell>
                <TableCell>{devolucion.proveedor?.razonSocial ?? "—"}</TableCell>
                <TableCell className="text-right">{devolucion._count.items}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/almacenes/devoluciones/${devolucion.id}`}>Ver</Link>
                  </Button>
                  <EliminarMovimientoButton
                    id={devolucion.id}
                    numero={devolucion.numero}
                    etiqueta="la devolución"
                    accion={eliminarDevolucionAlmacenAction}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
