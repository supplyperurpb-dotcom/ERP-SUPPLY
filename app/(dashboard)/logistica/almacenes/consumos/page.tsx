import Link from "next/link";
import { PackageMinus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";

export default async function ConsumosAlmacenPage() {
  const consumos = await prisma.consumoAlmacen.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { almacen: true, _count: { select: { items: true } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Consumos de almacén"
        descripcion="Salidas de materiales por consumo (no trasladados a otro almacén)."
        acciones={
          <Button asChild>
            <Link href="/logistica/almacenes/consumos/nuevo">
              <PackageMinus className="mr-2 h-4 w-4" />
              Nuevo consumo
            </Link>
          </Button>
        }
      />

      {consumos.length === 0 ? (
        <EmptyState
          icono={PackageMinus}
          titulo="Aún no hay consumos registrados"
          descripcion="Registra el primer consumo con el botón 'Nuevo consumo' de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumos.map((consumo) => (
              <TableRow key={consumo.id}>
                <TableCell className="font-medium">{consumo.numero}</TableCell>
                <TableCell>{formatDateTime(consumo.fecha)}</TableCell>
                <TableCell>{consumo.almacen.nombre}</TableCell>
                <TableCell className="text-right">{consumo._count.items}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/almacenes/consumos/${consumo.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
