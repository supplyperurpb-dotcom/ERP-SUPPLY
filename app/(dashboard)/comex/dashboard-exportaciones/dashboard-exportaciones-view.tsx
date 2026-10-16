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
  calcularPrecioPorKg,
  calcularEmbarquesCombinadoPorSemana,
  calcularKgPorSemanaYCampo,
  calcularResumenPorEstado,
  calcularPorLiquidar,
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
import { StackedBarChart } from "./stacked-bar-chart";
import { PrecioPorKgChart } from "./precio-por-kg-chart";

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

  // Mismos indicadores que la hoja "Reporte Expo" del Excel, ahora como
  // gráficos en vivo sobre esta misma data (ver lib/facturacion-exportacion.ts).
  const precioPorVariedad = useMemo(() => calcularPrecioPorKg(filasFiltradas, "variety"), [filasFiltradas]);
  const precioPorTipo = useMemo(() => calcularPrecioPorKg(filasFiltradas, "type"), [filasFiltradas]);
  const embarquesCombinadoPorSemana = useMemo(() => calcularEmbarquesCombinadoPorSemana(filasFiltradas), [filasFiltradas]);
  const kgPorSemanaTipo = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "type"), [filasFiltradas]);
  const kgPorSemanaEtiqueta = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "label"), [filasFiltradas]);

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
        titulo="Evolución Semanal de Precios"
        descripcion="PU CIF Facturado vs PU CIF Liquidado"
        puntos={evolucionPrecioSemanal}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg exportados por formato" filas={porFormato} mostrarEmbarques={false} />
        <DimensionBreakdownChart titulo="Kg Exportados Por Mercado" filas={porMercado} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg Exportados Por Puerto de Origen" filas={porOrigen} />
        <DimensionBreakdownChart titulo="Kg Exportados Por Puerto de Destino" filas={porDestino} />
      </div>

      <StackedBarChart
        titulo="Estatus de Embarques por Semana"
        descripcion="Kg arribados (semana ATA real) y en tránsito, proyectados a su semana ETA estimada. El n° de embarques de cada tramo sale al pasar el cursor."
        puntos={embarquesCombinadoPorSemana.puntos}
        series={embarquesCombinadoPorSemana.series}
        etiquetaSerie={(s) => (s === "ARRIBADO" ? "Arribado" : s === "EN TRANSITO" ? "En tránsito" : s)}
        ocultarPorcentaje
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PrecioPorKgChart titulo="Precio CIF/kg por variedad" filas={precioPorVariedad} />
        <PrecioPorKgChart titulo="Precio CIF/kg por tipo de producto" filas={precioPorTipo} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StackedBarChart
          titulo="Kg por semana de despacho según tipo de producto"
          puntos={kgPorSemanaTipo.puntos}
          series={kgPorSemanaTipo.series}
        />
        <StackedBarChart
          titulo="Kg por semana de despacho según etiqueta"
          puntos={kgPorSemanaEtiqueta.puntos}
          series={kgPorSemanaEtiqueta.series}
        />
      </div>
    </div>
  );
}
