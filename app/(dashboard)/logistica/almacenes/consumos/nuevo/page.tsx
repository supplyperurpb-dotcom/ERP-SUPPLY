import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { ConsumoAlmacenForm } from "./consumo-almacen-form";

export default async function NuevoConsumoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [almacenes, skus] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Nuevo consumo de almacén"
        descripcion="Registra el consumo de materiales de un almacén. El precio unitario ponderado se calcula automáticamente según los ingresos históricos de ese producto en ese almacén."
      />
      <ConsumoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        almacenIdInicial={almacenId}
      />
    </div>
  );
}
