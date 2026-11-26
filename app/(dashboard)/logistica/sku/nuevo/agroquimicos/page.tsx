import { PageHeader } from "@/components/shared/page-header";
import { obtenerFamiliasConSubfamilias } from "@/lib/actions/familia-actions";
import { AgroquimicoForm } from "./agroquimico-form";

export default async function NuevoSkuAgroquimicoPage() {
  const familias = await obtenerFamiliasConSubfamilias(["Agroquímico", "Fertilizante", "Ósmosis"]);

  return (
    <div>
      <PageHeader
        titulo="Nuevo SKU — Agroquímicos, Fertilizantes y Ósmosis"
        descripcion="El código se genera automáticamente según el tipo y la subfamilia elegidos."
      />
      <AgroquimicoForm familias={familias} />
    </div>
  );
}
