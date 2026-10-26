"use client";

import { useMemo, useState } from "react";
import {
  filtrarFacturacion,
  calcularKpis,
  agruparPorDimension,
  calcularEvolucionPrecioSemanal,
  calcularParticipacion,
  calcularParticipacionLiquidado,
  obtenerOpcionesFiltro,
  calcularExportacionesPorVariedadYMercado,
  calcularExportacionesPorVariedadYTipo,
  calcularExportacionesPorVariedadYEtiquetaPremium,
  calcularEmbarquesCombinadoPorSemana,
  calcularKgPorSemanaYCampo,
  calcularResumenPorEstado,
  calcularPorLiquidar,
  calcularImpactoLiquidacion,
  type FilaFacturacion,
  type FiltrosFacturacion,
} from "@/lib/facturacion-exportacion";
import { KpiCards } from "./kpi-cards";
import { PorLiquidarCard } from "./por-liquidar-card";
import { PremiumConvencionalCard } from "./premium-convencional-card";
import { EstadoResumenCards } from "./estado-resumen-cards";
import { FiltrosBar } from "./filtros-bar";
import { DimensionBreakdownChart } from "./dimension-breakdown-chart";
import { EvolucionPrecioChart } from "./evolucion-precio-chart";
import { ImpactoLiquidacionCard } from "./impacto-liquidacion-card";
import { StackedBarChart } from "./stacked-bar-chart";
import { VariedadMercadoChart } from "./variedad-mercado-chart";
import { VariedadTipoChart } from "./variedad-tipo-chart";
import { VariedadEtiquetaPremiumChart } from "./variedad-etiqueta-premium-chart";

export function DashboardExportacionesView({ filas }: { filas: FilaFacturacion[] }) {
  const opciones = useMemo(() => obtenerOpcionesFiltro(filas), [filas]);

  const [filtros, setFiltros] = useState<FiltrosFacturacion>({});
  const filasFiltradas = useMemo(() => filtrarFacturacion(filas, filtros), [filas, filtros]);

  const kpis = useMemo(() => calcularKpis(filasFiltradas), [filasFiltradas]);
  const porLiquidar = useMemo(() => calcularPorLiquidar(filasFiltradas), [filasFiltradas]);
  const participacionTipo = useMemo(() => calcularParticipacion(filasFiltradas, "type"), [filasFiltradas]);
  const participacionTipoLiquidado = useMemo(() => calcularParticipacionLiquidado(filasFiltradas, "type"), [filasFiltradas]);
  const porDestino = useMemo(() => agruparPorDimension(filasFiltradas, "destinationCountry"), [filasFiltradas]);
  const porMercado = useMemo(() => agruparPorDimension(filasFiltradas, "market"), [filasFiltradas]);
  const porOrigen = useMemo(() => agruparPorDimension(filasFiltradas, "originPort"), [filasFiltradas]);
  const porFormato = useMemo(() => agruparPorDimension(filasFiltradas, "format"), [filasFiltradas]);
  const evolucionPrecioSemanal = useMemo(() => calcularEvolucionPrecioSemanal(filasFiltradas), [filasFiltradas]);
  const impactoLiquidacion = useMemo(() => calcularImpactoLiquidacion(filasFiltradas), [filasFiltradas]);

  const exportacionesPorVariedadYMercado = useMemo(
    () => calcularExportacionesPorVariedadYMercado(filasFiltradas),
    [filasFiltradas]
  );
  const exportacionesPorVariedadYTipo = useMemo(() => calcularExportacionesPorVariedadYTipo(filasFiltradas), [filasFiltradas]);
  const exportacionesPorVariedadYEtiquetaPremium = useMemo(
    () => calcularExportacionesPorVariedadYEtiquetaPremium(filasFiltradas),
    [filasFiltradas]
  );
  const embarquesCombinadoPorSemana = useMemo(() => calcularEmbarquesCombinadoPorSemana(filasFiltradas), [filasFiltradas]);
  const kgPorSemanaTipo = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "type"), [filasFiltradas]);

  // Resumen rápido de contenedores (arribados vs. en agua).
  const resumenEstado = useMemo(() => calcularResumenPorEstado(filasFiltradas), [filasFiltradas]);

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay datos importados. Corre el script de importación.</p>;
  }

  return (
    <div className="space-y-6">
      <FiltrosBar filtros={filtros} opciones={opciones} onChange={setFiltros} onLimpiar={() => setFiltros({})} />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <KpiCards kpis={kpis} />
        <PorLiquidarCard datos={porLiquidar} />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Premium vs Convencional</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PremiumConvencionalCard titulo="Kg Facturados" datos={participacionTipo} colorFondo="#8dcfec" />
          <PremiumConvencionalCard titulo="Kg Liquidados" datos={participacionTipoLiquidado} />
        </div>
      </div>

      <EstadoResumenCards resumen={resumenEstado} />

      <EvolucionPrecioChart
        titulo="Evolución Semanal De Precios"
        descripcion="PU CIF Facturado vs PU CIF Liquidado"
        puntos={evolucionPrecioSemanal}
      />

      <ImpactoLiquidacionCard resumen={impactoLiquidacion} />

      <StackedBarChart
        titulo="Estatus De Embarques Por Semana"
        puntos={embarquesCombinadoPorSemana.puntos}
        series={embarquesCombinadoPorSemana.series}
        etiquetaSerie={(s) => (s === "ARRIBADO" ? "Arribado" : s === "EN TRANSITO" ? "En tránsito" : s)}
        ocultarPorcentaje
        formatearCategoria={(c) => `W${c}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg Exportados Por Formato" filas={porFormato} mostrarEmbarques={false} />
        <DimensionBreakdownChart titulo="Kg Exportados Por Mercado" filas={porMercado} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg Exportados Por Puerto De Origen" filas={porOrigen} />
        <DimensionBreakdownChart titulo="Kg Exportados Por Puerto De Destino" filas={porDestino} />
      </div>

      <StackedBarChart
        titulo="Kg Por Semana De Despacho Según Tipo De Producto"
        puntos={kgPorSemanaTipo.puntos}
        series={kgPorSemanaTipo.series}
      />

      <VariedadTipoChart titulo="Kg Exportados Por Variedad, Según Tipo" datos={exportacionesPorVariedadYTipo} />

      <VariedadEtiquetaPremiumChart
        titulo="Mezcla De Etiquetas Premium Por Variedad"
        datos={exportacionesPorVariedadYEtiquetaPremium}
      />

      <VariedadMercadoChart titulo="Kg Exportados Por Variedad, Según Mercado" datos={exportacionesPorVariedadYMercado} />
    </div>
  );
}
