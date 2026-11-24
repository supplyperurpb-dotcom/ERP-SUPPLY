import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ImportarPlForm } from "./importar-pl-form";

export default function NuevaImportacionPLPage() {
  return (
    <div>
      <Link href="/comex/importar-pl" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Volver a Importar PL
      </Link>
      <PageHeader
        titulo="Nueva importación de Packing List"
        descripcion="Sube el Excel del embarque, revisa la vista previa y confirma para registrarlo."
      />
      <ImportarPlForm />
    </div>
  );
}
