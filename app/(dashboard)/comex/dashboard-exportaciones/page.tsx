import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function DashboardExportacionesPage() {
  return (
    <div>
      <PageHeader
        titulo="Dashboard Exportaciones"
        descripcion="Gráficos y tendencias de facturación de exportación."
      />
      <EmptyState
        icono={BarChart3}
        titulo="Dashboard en construcción"
        descripcion="Todavía no tiene contenido configurado."
      />
    </div>
  );
}
