"use client";

import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoneda } from "@/lib/utils";
import {
  filtrarFacturacion,
  calcularKpis,
  agruparPorDimension,
  calcularEvolucionSemanal,
  calcularParticipacion,
  obtenerOpcionesFiltro,
  contarEmbarquesPorMercado,
  calcularPrecioPorKg,
  contarEmbarquesPorSemanaYEstado,
  calcularValorizadoPorSemanaYEstado,
  calcularKgPorSemanaYCampo,
  type FilaFacturacion,
  type FiltrosFacturacion,
} from "@/lib/facturacion-exportacion";
import { KpiCards } from "./kpi-cards";
import { FiltrosBar } from "./filtros-bar";
import { DimensionBreakdownChart } from "./dimension-breakdown-chart";
import { EvolucionChart } from "./evolucion-chart";
import { ParticipacionChart } from "./participacion-chart";
import { ComparativoPeriodos } from "./comparativo-periodos";
import { StackedBarChart } from "./stacked-bar-chart";
import { PrecioPorKgChart } from "./precio-por-kg-chart";

function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DashboardExportacionesView({ filas }: { filas: FilaFacturacion[] }) {
  const opciones = useMemo(() => obtenerOpcionesFiltro(filas), [filas]);

  const [filtros, setFiltros] = useState<FiltrosFacturacion>({});
  const filasFiltradas = useMemo(() => filtrarFacturacion(filas, filtros), [filas, filtros]);

  const kpis = useMemo(() => calcularKpis(filasFiltradas), [filasFiltradas]);
  const porDestino = useMemo(() => agruparPorDimension(filasFiltradas, "destinationCountry"), [filasFiltradas]);
  const porFormato = useMemo(() => agruparPorDimension(filasFiltradas, "format"), [filasFiltradas]);
  const evolucionSemanal = useMemo(() => calcularEvolucionSemanal(filasFiltradas), [filasFiltradas]);
  const participacionDestino = useMemo(() => calcularParticipacion(filasFiltradas, "destinationCountry"), [filasFiltradas]);
  const participacionMercado = useMemo(() => calcularParticipacion(filasFiltradas, "market"), [filasFiltradas]);

  // Mismos indicadores que la hoja "Reporte Expo" del Excel, ahora como
  // gráficos en vivo sobre esta misma data (ver lib/facturacion-exportacion.ts).
  const embarquesPorMercado = useMemo(() => contarEmbarquesPorMercado(filasFiltradas), [filasFiltradas]);
  const precioPorVariedad = useMemo(() => calcularPrecioPorKg(filasFiltradas, "variety"), [filasFiltradas]);
  const precioPorTipo = useMemo(() => calcularPrecioPorKg(filasFiltradas, "type"), [filasFiltradas]);
  const embarquesPorSemanaEta = useMemo(() => contarEmbarquesPorSemanaYEstado(filasFiltradas, "weekEta"), [filasFiltradas]);
  const valorizadoPorSemanaAta = useMemo(() => calcularValorizadoPorSemanaYEstado(filasFiltradas, "weekAta"), [filasFiltradas]);
  const kgPorSemanaTipo = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "type"), [filasFiltradas]);
  const kgPorSemanaEtiqueta = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "label"), [filasFiltradas]);

  // Comparativo entre periodos: mismos cliente/mercado/destino del filtro
  // de arriba, pero con su propio rango de fechas (dos, A y B). Por
  // defecto compara el último mes con datos contra el mes anterior — son
  // fechas reales de la data (fechaMax), no un supuesto "hoy".
  const fechaMaxData = opciones.fechaMax ? new Date(opciones.fechaMax) : new Date();
  const [periodoA, setPeriodoA] = useState({
    desde: aISO(startOfMonth(subMonths(fechaMaxData, 1))),
    hasta: aISO(endOfMonth(subMonths(fechaMaxData, 1))),
  });
  const [periodoB, setPeriodoB] = useState({
    desde: aISO(startOfMonth(fechaMaxData)),
    hasta: aISO(fechaMaxData),
  });
  const filtrosSinFecha: FiltrosFacturacion = useMemo(
    () => ({ market: filtros.market, destinationCountry: filtros.destinationCountry }),
    [filtros.market, filtros.destinationCountry]
  );
  const kpisPeriodoA = useMemo(
    () => calcularKpis(filtrarFacturacion(filas, { ...filtrosSinFecha, fechaDesde: periodoA.desde, fechaHasta: periodoA.hasta })),
    [filas, filtrosSinFecha, periodoA]
  );
  const kpisPeriodoB = useMemo(
    () => calcularKpis(filtrarFacturacion(filas, { ...filtrosSinFecha, fechaDesde: periodoB.desde, fechaHasta: periodoB.hasta })),
    [filas, filtrosSinFecha, periodoB]
  );

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay datos importados. Corre el script de importación.</p>;
  }

  return (
    <div className="space-y-6">
      <FiltrosBar filtros={filtros} opciones={opciones} onChange={setFiltros} onLimpiar={() => setFiltros({})} />

      <KpiCards kpis={kpis} />

      <EvolucionChart titulo="Evolución Semanal de Facturación" puntos={evolucionSemanal} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg exportados por formato" filas={porFormato} />
        <DimensionBreakdownChart titulo="Kg exportados por destino" filas={porDestino} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ParticipacionChart titulo="Participación por destino (kg)" datos={participacionDestino} />
        <ParticipacionChart titulo="Participación por mercado (kg)" datos={participacionMercado} />
      </div>

      <div className="space-y-1 pt-2">
        <h2 className="text-lg font-semibold">Basado en el Reporte Expo</h2>
        <p className="text-sm text-muted-foreground">
          Los mismos indicadores que el reporte dinámico del Excel (&quot;Reporte Expo&quot;), como gráficos en vivo sobre esta
          misma base de Facturación.
        </p>
      </div>

      <StackedBarChart
        titulo="Embarques ejecutados por mercado"
        descripcion="N° de embarques (PO) distintos, segmentados por modo de transporte."
        puntos={embarquesPorMercado.puntos}
        series={embarquesPorMercado.series}
        formatearValor={(v) => String(Math.round(v))}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PrecioPorKgChart titulo="Precio CIF/kg por variedad" filas={precioPorVariedad} />
        <PrecioPorKgChart titulo="Precio CIF/kg por tipo de producto" filas={precioPorTipo} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StackedBarChart
          titulo="Embarques por semana ETA según estado"
          descripcion="N° de embarques (PO), por semana estimada de llegada."
          puntos={embarquesPorSemanaEta.puntos}
          series={embarquesPorSemanaEta.series}
          formatearValor={(v) => String(Math.round(v))}
        />
        <StackedBarChart
          titulo="Valorizado por semana ATA según estado"
          descripcion="Facturado (USD), por semana real de llegada."
          puntos={valorizadoPorSemanaAta.puntos}
          series={valorizadoPorSemanaAta.series}
          formatearValor={(v) => formatMoneda(v, "USD")}
        />
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

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="periodoADesde">Periodo A — desde</Label>
              <Input
                id="periodoADesde"
                type="date"
                value={periodoA.desde}
                onChange={(e) => setPeriodoA({ ...periodoA, desde: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodoAHasta">Periodo A — hasta</Label>
              <Input
                id="periodoAHasta"
                type="date"
                value={periodoA.hasta}
                onChange={(e) => setPeriodoA({ ...periodoA, hasta: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="periodoBDesde">Periodo B — desde</Label>
              <Input
                id="periodoBDesde"
                type="date"
                value={periodoB.desde}
                onChange={(e) => setPeriodoB({ ...periodoB, desde: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodoBHasta">Periodo B — hasta</Label>
              <Input
                id="periodoBHasta"
                type="date"
                value={periodoB.hasta}
                onChange={(e) => setPeriodoB({ ...periodoB, hasta: e.target.value })}
              />
            </div>
          </div>
        </div>
        <ComparativoPeriodos
          etiquetaA={formatearRango(periodoA.desde, periodoA.hasta)}
          etiquetaB={formatearRango(periodoB.desde, periodoB.hasta)}
          kpisA={kpisPeriodoA}
          kpisB={kpisPeriodoB}
        />
      </div>
    </div>
  );
}

function formatearRango(desde: string, hasta: string): string {
  const f = (iso: string) => format(new Date(`${iso}T00:00:00`), "d MMM yyyy", { locale: es });
  return `${f(desde)} – ${f(hasta)}`;
}
