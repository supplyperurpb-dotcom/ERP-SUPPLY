import Link from "next/link";
import { PackagePlus, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { FiltroAreaIngresos } from "./filtro-area-ingresos";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";
import { AREAS_SOLPED, type AreaSolpedCodigo } from "@/lib/constants/compras";
import { eliminarIngresoAlmacenAction } from "@/lib/actions/ingreso-almacen-actions";

export default async function IngresosAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ areaDetalle?: string }>;
}) {
  const { areaDetalle } = await searchParams;

  const ingresos = await prisma.ingresoAlmacen.findMany({
    where: areaDetalle ? { items: { some: { areaDetalle } } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { almacen: true, proveedor: true, items: { select: { areaDetalle: true } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Ingresos a almacén"
        descripcion="Ingresos de productos (insumos, agroquímicos, material de empaque, etc.) a los almacenes. El Área solicitante se jala automáticamente de la Solicitud de Pedido detrás de la OC, para poder filtrar qué stock le pertenece a cada área."
        acciones={
          <>
            <Button variant="outline" asChild>
              <Link href="/api/excel/almacenes/ingresos">
                <Download className="mr-2 h-4 w-4" />
                Exportar a Excel
              </Link>
            </Button>
            <Button asChild>
              <Link href="/logistica/almacenes/ingresos/nuevo">
                <PackagePlus className="mr-2 h-4 w-4" />
                Nuevo ingreso
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <FiltroAreaIngresos areaDetalleActual={areaDetalle as AreaSolpedCodigo | undefined} />
      </div>

      {ingresos.length === 0 ? (
        <EmptyState
          icono={PackagePlus}
          titulo="Aún no hay ingresos registrados"
          descripcion={
            areaDetalle
              ? "Ningún ingreso tiene una línea de esa área."
              : "Registra el primer ingreso con el botón 'Nuevo ingreso' de arriba."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>N° OC</TableHead>
              <TableHead>Área solicitante</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Guía</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingresos.map((ingreso) => {
              // Casi siempre es una sola; puede haber más de una si la OC
              // jaló líneas de Solpeds de áreas distintas.
              const areasDelIngreso = [...new Set(ingreso.items.map((i) => i.areaDetalle).filter((a): a is string => !!a))].map(
                (a) => AREAS_SOLPED.find((as) => as.valor === a)?.nombre ?? a
              );
              return (
                <TableRow key={ingreso.id}>
                  <TableCell className="font-medium">{ingreso.numero}</TableCell>
                  <TableCell>{formatDateTime(ingreso.fecha)}</TableCell>
                  <TableCell>{ingreso.almacen.nombre}</TableCell>
                  <TableCell>{ingreso.ocNumero ?? "—"}</TableCell>
                  <TableCell>{areasDelIngreso.length > 0 ? areasDelIngreso.join(", ") : "—"}</TableCell>
                  <TableCell>{ingreso.proveedor?.razonSocial ?? "—"}</TableCell>
                  <TableCell>{ingreso.guiaRemision ?? "—"}</TableCell>
                  <TableCell className="text-right">{ingreso.items.length}</TableCell>
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
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
