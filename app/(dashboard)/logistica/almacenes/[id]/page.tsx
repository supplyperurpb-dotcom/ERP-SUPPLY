import Link from "next/link";
import { notFound } from "next/navigation";
import { PackagePlus, ArrowLeftRight, PackageMinus, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { calcularReporteStock, calcularMovimientosAlmacen } from "@/lib/stock-almacen";
import { serializar } from "@/lib/utils";
import { AlmacenStockMovimientos } from "./almacen-stock-movimientos";

export default async function AlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const almacen = await prisma.almacen.findUnique({ where: { id } });
  if (!almacen) notFound();

  const [stock, movimientos] = await Promise.all([calcularReporteStock(id), calcularMovimientosAlmacen(id)]);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo={almacen.nombre}
        descripcion={`Código ${almacen.codigo}${almacen.ubicacion ? ` · ${almacen.ubicacion}` : ""}`}
        acciones={
          almacen.activo ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/logistica/almacenes/ingresos/nuevo?almacenId=${id}`}>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Ingreso
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/logistica/almacenes/traslados/nuevo?almacenId=${id}`}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Traslado
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/logistica/almacenes/consumos/nuevo?almacenId=${id}`}>
                  <PackageMinus className="mr-2 h-4 w-4" />
                  Consumo
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/logistica/almacenes/devoluciones/nuevo?almacenId=${id}`}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Devolución
                </Link>
              </Button>
            </>
          ) : (
            <Badge variant="secondary">Inactivo</Badge>
          )
        }
      />
      {!almacen.activo && (
        <p className="-mt-6 text-sm text-muted-foreground">
          Este almacén está inactivo: no se pueden registrar ingresos, traslados, consumos ni devoluciones hasta que
          se active desde el catálogo de almacenes.
        </p>
      )}

      <AlmacenStockMovimientos stock={serializar(stock)} movimientos={serializar(movimientos)} />
    </div>
  );
}
