import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { SkuFormDialog } from "./sku-form-dialog";
import { SkuTable } from "./sku-table";

export default async function SkuPage() {
  const skus = await prisma.sku.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        titulo="SKU"
        descripcion="Catálogo de códigos de producto e insumo."
        acciones={<SkuFormDialog />}
      />

      {skus.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo="Aún no hay SKU registrados"
          descripcion="Crea el primer código SKU para insumos o productos terminados."
        />
      ) : (
        <SkuTable skus={skus} />
      )}
    </div>
  );
}
