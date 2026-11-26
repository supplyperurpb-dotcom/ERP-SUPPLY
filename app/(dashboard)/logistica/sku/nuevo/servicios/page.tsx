import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { obtenerFamiliasConSubfamilias } from "@/lib/actions/familia-actions";
import { ServicioForm } from "./servicio-form";

export default async function NuevoSkuServicioPage() {
  const [skus, familias] = await Promise.all([
    prisma.sku.findMany({
      where: { categoria: "Servicios" },
      select: { codigo: true, descripcion: true },
      orderBy: { descripcion: "asc" },
    }),
    obtenerFamiliasConSubfamilias(["Servicios"]),
  ]);

  return (
    <div>
      <PageHeader titulo="Nuevo SKU — Servicios" descripcion="El código se genera automáticamente: SERV + correlativo." />
      <ServicioForm skusExistentes={skus} subfamilias={familias[0]?.subfamilias ?? []} />
    </div>
  );
}
