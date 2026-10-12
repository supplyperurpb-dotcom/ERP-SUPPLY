import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DashboardExportacionesView } from "./dashboard-exportaciones-view";

export default async function DashboardExportacionesPage() {
  const filas = await prisma.facturacionExportacion.findMany({
    select: {
      dispatchDate: true,
      dispWeek: true,
      customer: true,
      market: true,
      destinationCountry: true,
      format: true,
      invoicedAmount: true,
      cifLiquidatedTariffs: true,
      netWeight: true,
      netKilosLiquidated: true,
    },
    orderBy: { dispatchDate: "asc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Dashboard Exportaciones"
        descripcion="Facturación de exportación — datos de la hoja Facturación del Excel de facturación."
      />
      <DashboardExportacionesView
        filas={filas.map((f) => ({
          dispatchDate: f.dispatchDate,
          dispWeek: f.dispWeek,
          customer: f.customer,
          market: f.market,
          destinationCountry: f.destinationCountry,
          format: f.format,
          invoicedAmount: Number(f.invoicedAmount),
          cifLiquidatedTariffs: Number(f.cifLiquidatedTariffs),
          netWeight: Number(f.netWeight),
          netKilosLiquidated: Number(f.netKilosLiquidated),
        }))}
      />
    </div>
  );
}
