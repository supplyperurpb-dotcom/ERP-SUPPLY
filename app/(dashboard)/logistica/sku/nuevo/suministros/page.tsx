import { PageHeader } from "@/components/shared/page-header";
import { SuministroForm } from "./suministro-form";

export default function NuevoSkuSuministroPage() {
  return (
    <div>
      <PageHeader titulo="Nuevo SKU — Suministros" descripcion="El código se genera automáticamente según la subfamilia elegida." />
      <SuministroForm />
    </div>
  );
}
