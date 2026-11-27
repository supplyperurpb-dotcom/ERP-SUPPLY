import Link from "next/link";
import { ArrowLeftRight, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AlmacenesInicioPage() {
  return (
    <div>
      <PageHeader titulo="Almacenes" descripcion="Movimientos de inventario y catálogo de almacenes." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/logistica/almacenes/movimientos">
          <Card className="h-full transition-colors hover:border-primary hover:bg-accent/40">
            <CardHeader>
              <ArrowLeftRight className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">Movimientos</CardTitle>
              <CardDescription>
                Resumen de ingresos, consumos, traslados y devoluciones. Filtra por proveedor, número o fecha, y
                registra un nuevo movimiento.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/logistica/almacenes/catalogo">
          <Card className="h-full transition-colors hover:border-primary hover:bg-accent/40">
            <CardHeader>
              <Warehouse className="mb-2 h-6 w-6 text-primary" />
              <CardTitle className="text-base">Almacenes</CardTitle>
              <CardDescription>
                Catálogo de almacenes generales (donde se registran los ingresos) y sus sub-almacenes (que reciben
                inventario por traslado).
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
