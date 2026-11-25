import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { aFilaFacturacion, SELECT_SUBCONJUNTO_TIPADO } from "@/lib/comex/mapeo-facturacion";
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
    select: SELECT_SUBCONJUNTO_TIPADO,
    orderBy: { dispatchDate: "asc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Resumen de Exportaciones (Prueba)"
        descripcion="Misma información y cálculos del Dashboard Exportaciones original, pero leyendo desde la migración histórica en Supabase (HistoricalBilling) en vez del Excel sincronizado a mano."
      />
      <DashboardExportacionesView filas={filas.map(aFilaFacturacion)} />
    </div>
  );
}
