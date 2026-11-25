import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ImportarFacturacionHistoricaForm } from "./importar-facturacion-historica-form";

export default function NuevaImportacionFacturacionHistoricaPage() {
  return (
    <div>
      <Link
        href="/comex/importar-facturacion-historica"
        className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver a Importar Facturación
      </Link>
      <PageHeader titulo="Nueva migración histórica" descripcion="Sube el Excel de Facturación de exportación (hoja «Facturación»)." />
      <ImportarFacturacionHistoricaForm />
    </div>
  );
}
