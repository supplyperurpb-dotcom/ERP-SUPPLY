import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DashboardExportacionesView } from "../dashboard-exportaciones/dashboard-exportaciones-view";

// Réplica funcional del Dashboard Exportaciones original (mismo diseño,
// mismos componentes, mismo motor de cálculo en lib/facturacion-exportacion.ts)
// pero leyendo de HistoricalBilling (Supabase, migración histórica con las
// 130 columnas originales) en vez de facturacion_exportacion (tabla que
// alimenta el dashboard original, sincronizada a mano desde el Excel). Ver
// plan "COMEX: Base de datos centralizada de Exportaciones" — Etapa B. El
// dashboard original NO se modifica.
export default async function DashboardExportacionesPruebaPage() {
  const filas = await prisma.historicalBilling.findMany({
    select: {
      dispatchDate: true,
      dispWeek: true,
      customer: true,
      market: true,
      originPort: true,
      destinationCountry: true,
      format: true,
      po: true,
      transportMode: true,
      weekEta: true,
      weekAta: true,
      statusEmbarque: true,
      settlementStatus: true,
      variety: true,
      type: true,
      label: true,
      destino: true,
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
        titulo="Resumen de Exportaciones (Prueba)"
        descripcion="Misma información y cálculos del Dashboard Exportaciones original, pero leyendo desde la migración histórica en Supabase (HistoricalBilling) en vez del Excel sincronizado a mano."
      />
      <DashboardExportacionesView
        filas={filas.map((f) => ({
          dispatchDate: f.dispatchDate,
          dispWeek: f.dispWeek,
          customer: f.customer,
          market: f.market,
          originPort: f.originPort,
          destinationCountry: f.destinationCountry,
          format: f.format,
          po: f.po,
          transportMode: f.transportMode,
          weekEta: f.weekEta,
          weekAta: f.weekAta,
          statusEmbarque: f.statusEmbarque,
          settlementStatus: f.settlementStatus,
          variety: f.variety,
          type: f.type,
          label: f.label,
          destino: f.destino,
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
