import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoAlmacenForm } from "./ingreso-almacen-form";

export default async function NuevoIngresoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [almacenes, proveedores, skus] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso a almacén"
        descripcion="Registra el ingreso de productos a un almacén: OC, guía de remisión, proveedor, productos, precios y cantidades."
      />
      <IngresoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        proveedores={proveedores.map((p) => ({ id: p.id, razonSocial: p.razonSocial }))}
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        almacenIdInicial={almacenId}
      />
    </div>
  );
}
