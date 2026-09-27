import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";
import { eliminarIngresoAlmacenAction } from "@/lib/actions/ingreso-almacen-actions";

export default async function IngresosAlmacenPage() {
  const ingresos = await prisma.ingresoAlmacen.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { almacen: true, proveedor: true, _count: { select: { items: true } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Ingresos a almacén"
        descripcion="Ingresos de productos (insumos, agroquímicos, material de empaque, etc.) a los almacenes."
        acciones={
          <Button asChild>
            <Link href="/logistica/almacenes/ingresos/nuevo">
              <PackagePlus className="mr-2 h-4 w-4" />
              Nuevo ingreso
            </Link>
          </Button>
        }
      />

      {ingresos.length === 0 ? (
        <EmptyState
          icono={PackagePlus}
          titulo="Aún no hay ingresos registrados"
          descripcion="Registra el primer ingreso con el botón 'Nuevo ingreso' de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Guía</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingresos.map((ingreso) => (
              <TableRow key={ingreso.id}>
                <TableCell className="font-medium">{ingreso.numero}</TableCell>
                <TableCell>{formatDateTime(ingreso.fecha)}</TableCell>
                <TableCell>{ingreso.almacen.nombre}</TableCell>
                <TableCell>{ingreso.proveedor?.razonSocial ?? "—"}</TableCell>
                <TableCell>{ingreso.guiaRemision ?? "—"}</TableCell>
                <TableCell className="text-right">{ingreso._count.items}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/almacenes/ingresos/${ingreso.id}`}>Ver</Link>
                  </Button>
                  <EliminarMovimientoButton
                    id={ingreso.id}
                    numero={ingreso.numero}
                    etiqueta="el ingreso"
                    accion={eliminarIngresoAlmacenAction}
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
