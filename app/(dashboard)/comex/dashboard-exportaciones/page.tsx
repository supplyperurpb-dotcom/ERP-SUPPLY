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
      po: true,
      transportMode: true,
      weekEta: true,
      weekAta: true,
      statusEmbarque: true,
      variety: true,
      type: true,
      label: true,
      totalFob: true,
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
          po: f.po,
          transportMode: f.transportMode,
          weekEta: f.weekEta,
          weekAta: f.weekAta,
          statusEmbarque: f.statusEmbarque,
          variety: f.variety,
          type: f.type,
          label: f.label,
          totalFob: Number(f.totalFob),
          invoicedAmount: Number(f.invoicedAmount),
          cifLiquidatedTariffs: Number(f.cifLiquidatedTariffs),
          netWeight: Number(f.netWeight),
          netKilosLiquidated: Number(f.netKilosLiquidated),
        }))}
      />
    </div>
  );
}
