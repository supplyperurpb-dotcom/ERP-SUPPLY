import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { serializar } from "@/lib/utils";
import { SkuTable } from "./sku-table";

export default async function SkuPage() {
  const skus = serializar(await prisma.sku.findMany({ orderBy: { createdAt: "desc" } }));

  return (
    <div>
      <PageHeader
        titulo="SKU"
        descripcion="Catálogo de códigos de producto e insumo. Elige la categoría para generar el código automáticamente."
        acciones={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/logistica/sku/nuevo/suministros">
                <Plus className="mr-2 h-4 w-4" />
                Suministros
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/logistica/sku/nuevo/agroquimicos">
                <Plus className="mr-2 h-4 w-4" />
                Agroquímicos, Fertilizantes y Ósmosis
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/logistica/sku/nuevo/servicios">
                <Plus className="mr-2 h-4 w-4" />
                Servicios
              </Link>
            </Button>
          </div>
        }
      />

      {skus.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo="Aún no hay SKU registrados"
          descripcion="Crea el primer código SKU con uno de los botones de arriba, según la categoría."
        />
      ) : (
        <SkuTable skus={skus} />
      )}
    </div>
  );
}
