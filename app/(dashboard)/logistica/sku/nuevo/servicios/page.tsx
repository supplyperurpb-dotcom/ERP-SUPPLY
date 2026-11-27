import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { serializar } from "@/lib/utils";
import { getUsuarioActual } from "@/lib/auth/session";
import { esComprador } from "@/lib/compras";
import { obtenerFamiliasConSubfamilias } from "@/lib/actions/familia-actions";
import { ServicioForm } from "./servicio-form";

export default async function NuevoSkuServicioPage() {
  const [skusRaw, familias, usuario] = await Promise.all([
    prisma.sku.findMany({ where: { categoria: "Servicios" }, orderBy: { descripcion: "asc" } }),
    obtenerFamiliasConSubfamilias(["Servicios"]),
    getUsuarioActual(),
  ]);
  const skus = serializar(skusRaw);
  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;
  const puedeEditar = usuario ? esComprador(usuario) : false;

  return (
    <div>
      <PageHeader titulo="Nuevo SKU — Servicios" descripcion="El código se genera automáticamente: SERV + correlativo." />
      <ServicioForm
        skusExistentes={skus}
        subfamilias={familias[0]?.subfamilias ?? []}
        esAdmin={esAdmin}
        puedeEditar={puedeEditar}
      />
    </div>
  );
}
