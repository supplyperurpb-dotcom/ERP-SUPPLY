import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DashboardExportacionesView } from "./dashboard-exportaciones-view";

export default async function DashboardExportacionesPage() {
  const filas = await prisma.facturacionExportacion.findMany({
    select: {
      dispWeek: true,
      invoicedAmount: true,
      cifLiquidatedTariffs: true,
      netWeight: true,
      netKilosLiquidated: true,
    },
    orderBy: { dispWeek: "asc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Dashboard Exportaciones"
        descripcion="Facturación de exportación — datos de la hoja Facturación del Excel de facturación."
      />
      <DashboardExportacionesView
        filas={filas.map((f) => ({
          dispWeek: f.dispWeek,
          invoicedAmount: Number(f.invoicedAmount),
          cifLiquidatedTariffs: Number(f.cifLiquidatedTariffs),
          netWeight: Number(f.netWeight),
          netKilosLiquidated: Number(f.netKilosLiquidated),
        }))}
      />
    </div>
  );
}
