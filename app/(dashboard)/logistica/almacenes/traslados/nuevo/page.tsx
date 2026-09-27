import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { TrasladoAlmacenForm } from "./traslado-almacen-form";

export default async function NuevoTrasladoAlmacenPage({
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
        titulo="Nuevo traslado entre almacenes"
        descripcion="Mueve productos de un almacén a otro. El stock del almacén de origen disminuye y el del destino aumenta según las cantidades trasladadas."
      />
      <TrasladoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        almacenOrigenIdInicial={almacenId}
      />
    </div>
  );
}
