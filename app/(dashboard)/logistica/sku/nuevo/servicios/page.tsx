import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { ServicioForm } from "./servicio-form";

export default async function NuevoSkuServicioPage() {
  const skus = await prisma.sku.findMany({
    where: { categoria: "Servicios" },
    select: { codigo: true, descripcion: true },
    orderBy: { descripcion: "asc" },
  });

  return (
    <div>
      <PageHeader titulo="Nuevo SKU — Servicios" descripcion="El código se genera automáticamente: SERV + correlativo." />
      <ServicioForm skusExistentes={skus} />
    </div>
  );
}
