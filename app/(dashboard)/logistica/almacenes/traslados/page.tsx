import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";
import { eliminarTrasladoAlmacenAction } from "@/lib/actions/traslado-almacen-actions";

export default async function TrasladosAlmacenPage() {
  const traslados = await prisma.trasladoAlmacen.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { almacenOrigen: true, almacenDestino: true, _count: { select: { items: true } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Traslados entre almacenes"
        descripcion="Movimientos de productos de un almacén a otro."
        acciones={
          <Button asChild>
            <Link href="/logistica/almacenes/traslados/nuevo">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Nuevo traslado
            </Link>
          </Button>
        }
      />

      {traslados.length === 0 ? (
        <EmptyState
          icono={ArrowLeftRight}
          titulo="Aún no hay traslados registrados"
          descripcion="Registra el primer traslado con el botón 'Nuevo traslado' de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Guía</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traslados.map((traslado) => (
              <TableRow key={traslado.id}>
                <TableCell className="font-medium">{traslado.numero}</TableCell>
                <TableCell>{formatDateTime(traslado.fecha)}</TableCell>
                <TableCell>{traslado.almacenOrigen.nombre}</TableCell>
                <TableCell>{traslado.almacenDestino.nombre}</TableCell>
                <TableCell>{traslado.guiaRemision ?? "—"}</TableCell>
                <TableCell className="text-right">{traslado._count.items}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/almacenes/traslados/${traslado.id}`}>Ver</Link>
                  </Button>
                  <EliminarMovimientoButton
                    id={traslado.id}
                    numero={traslado.numero}
                    etiqueta="el traslado"
                    accion={eliminarTrasladoAlmacenAction}
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
