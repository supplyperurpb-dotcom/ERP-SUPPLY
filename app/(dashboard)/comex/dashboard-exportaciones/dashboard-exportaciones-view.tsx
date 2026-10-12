"use client";

import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  filtrarFacturacion,
  calcularKpis,
  agruparPorDimension,
  calcularEvolucionSemanal,
  calcularEvolucionMensual,
  calcularParticipacionPorDestino,
  obtenerOpcionesFiltro,
  type FilaFacturacion,
  type FiltrosFacturacion,
} from "@/lib/facturacion-exportacion";
import { KpiCards } from "./kpi-cards";
import { FiltrosBar } from "./filtros-bar";
import { DimensionBreakdownChart } from "./dimension-breakdown-chart";
import { EvolucionChart } from "./evolucion-chart";
import { ParticipacionDestinoChart } from "./participacion-destino-chart";
import { ComparativoPeriodos } from "./comparativo-periodos";

function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DashboardExportacionesView({ filas }: { filas: FilaFacturacion[] }) {
  const opciones = useMemo(() => obtenerOpcionesFiltro(filas), [filas]);

  const [filtros, setFiltros] = useState<FiltrosFacturacion>({});
  const filasFiltradas = useMemo(() => filtrarFacturacion(filas, filtros), [filas, filtros]);

  const kpis = useMemo(() => calcularKpis(filasFiltradas), [filasFiltradas]);
  const porCliente = useMemo(() => agruparPorDimension(filasFiltradas, "customer"), [filasFiltradas]);
  const porMercado = useMemo(() => agruparPorDimension(filasFiltradas, "market"), [filasFiltradas]);
  const porDestino = useMemo(() => agruparPorDimension(filasFiltradas, "destinationCountry"), [filasFiltradas]);
  const porFormato = useMemo(() => agruparPorDimension(filasFiltradas, "format"), [filasFiltradas]);
  const evolucionSemanal = useMemo(() => calcularEvolucionSemanal(filasFiltradas), [filasFiltradas]);
  const evolucionMensual = useMemo(() => calcularEvolucionMensual(filasFiltradas), [filasFiltradas]);
  const participacionDestino = useMemo(() => calcularParticipacionPorDestino(filasFiltradas), [filasFiltradas]);

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
    () => ({ customer: filtros.customer, market: filtros.market, destinationCountry: filtros.destinationCountry }),
    [filtros.customer, filtros.market, filtros.destinationCountry]
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EvolucionChart titulo="Evolución semanal" puntos={evolucionSemanal} />
        <EvolucionChart titulo="Evolución mensual" puntos={evolucionMensual} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg exportados por formato" filas={porFormato} />
        <ParticipacionDestinoChart datos={participacionDestino} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg exportados por destino" filas={porDestino} />
        <DimensionBreakdownChart titulo="Kg exportados por mercado" filas={porMercado} />
      </div>

      <DimensionBreakdownChart titulo="Kg exportados por cliente" filas={porCliente} />

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
