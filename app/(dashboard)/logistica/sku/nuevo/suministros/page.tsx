import { PageHeader } from "@/components/shared/page-header";
import { obtenerFamiliasConSubfamilias } from "@/lib/actions/familia-actions";
import { SuministroForm } from "./suministro-form";

export default async function NuevoSkuSuministroPage() {
  const familias = await obtenerFamiliasConSubfamilias(["Suministros"]);

  return (
    <div>
      <PageHeader titulo="Nuevo SKU — Suministros" descripcion="El código se genera automáticamente según la subfamilia elegida." />
      <SuministroForm subfamilias={familias[0]?.subfamilias ?? []} />
    </div>
  );
}
