import { PageHeader } from "@/components/shared/page-header";
import { AgroquimicoForm } from "./agroquimico-form";

export default function NuevoSkuAgroquimicoPage() {
  return (
    <div>
      <PageHeader
        titulo="Nuevo SKU — Agroquímicos, Fertilizantes y Ósmosis"
        descripcion="El código se genera automáticamente según el tipo y la subfamilia elegidos."
      />
      <AgroquimicoForm />
    </div>
  );
}
