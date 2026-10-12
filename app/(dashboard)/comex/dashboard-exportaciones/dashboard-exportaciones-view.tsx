"use client";

import { useMemo, useState } from "react";
import { formatMoneda } from "@/lib/utils";
import {
  filtrarFacturacion,
  calcularKpis,
  agruparPorDimension,
  calcularEvolucionSemanal,
  calcularParticipacion,
  obtenerOpcionesFiltro,
  calcularEmbarquesPorMercadoSegunModo,
  calcularPrecioPorKg,
  contarEmbarquesPorSemanaCombinada,
  calcularValorizadoPorSemanaYEstado,
  calcularKgPorSemanaYCampo,
  calcularResumenPorEstado,
  calcularContenedoresPorDestinoYEstado,
  calcularContenedoresProyectadosPorSemana,
  type FilaFacturacion,
  type FiltrosFacturacion,
} from "@/lib/facturacion-exportacion";
import { KpiCards } from "./kpi-cards";
import { PremiumConvencionalCard } from "./premium-convencional-card";
import { EstadoResumenCards } from "./estado-resumen-cards";
import { FiltrosBar } from "./filtros-bar";
import { DimensionBreakdownChart } from "./dimension-breakdown-chart";
import { EvolucionChart } from "./evolucion-chart";
import { ParticipacionChart } from "./participacion-chart";
import { StackedBarChart } from "./stacked-bar-chart";
import { PrecioPorKgChart } from "./precio-por-kg-chart";
import { EmbarquesPorMercadoPie } from "./embarques-por-mercado-pie";

export function DashboardExportacionesView({ filas }: { filas: FilaFacturacion[] }) {
  const opciones = useMemo(() => obtenerOpcionesFiltro(filas), [filas]);

  const [filtros, setFiltros] = useState<FiltrosFacturacion>({});
  const filasFiltradas = useMemo(() => filtrarFacturacion(filas, filtros), [filas, filtros]);

  const kpis = useMemo(() => calcularKpis(filasFiltradas), [filasFiltradas]);
  const participacionTipo = useMemo(() => calcularParticipacion(filasFiltradas, "type"), [filasFiltradas]);
  const porDestino = useMemo(() => agruparPorDimension(filasFiltradas, "destinationCountry"), [filasFiltradas]);
  const porFormato = useMemo(() => agruparPorDimension(filasFiltradas, "format"), [filasFiltradas]);
  const evolucionSemanal = useMemo(() => calcularEvolucionSemanal(filasFiltradas), [filasFiltradas]);
  const participacionDestino = useMemo(() => calcularParticipacion(filasFiltradas, "destinationCountry"), [filasFiltradas]);
  const participacionMercado = useMemo(() => calcularParticipacion(filasFiltradas, "market"), [filasFiltradas]);

  // Mismos indicadores que la hoja "Reporte Expo" del Excel, ahora como
  // gráficos en vivo sobre esta misma data (ver lib/facturacion-exportacion.ts).
  // Un pastel de kg por mercado por cada modo de transporte real presente
  // en el filtro actual (hoy AEREO y MARITIMO, pero nunca una lista fija).
  const modosTransporte = useMemo(() => [...new Set(filasFiltradas.map((f) => f.transportMode))].sort(), [filasFiltradas]);
  const embarquesPorMercadoSegunModo = useMemo(
    () => modosTransporte.map((modo) => ({ modo, datos: calcularEmbarquesPorMercadoSegunModo(filasFiltradas, modo) })),
    [filasFiltradas, modosTransporte]
  );
  const precioPorVariedad = useMemo(() => calcularPrecioPorKg(filasFiltradas, "variety"), [filasFiltradas]);
  const precioPorTipo = useMemo(() => calcularPrecioPorKg(filasFiltradas, "type"), [filasFiltradas]);
  const embarquesPorSemanaCombinada = useMemo(() => contarEmbarquesPorSemanaCombinada(filasFiltradas), [filasFiltradas]);
  const valorizadoPorSemanaAta = useMemo(() => calcularValorizadoPorSemanaYEstado(filasFiltradas, "weekAta"), [filasFiltradas]);
  const kgPorSemanaTipo = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "type"), [filasFiltradas]);
  const kgPorSemanaEtiqueta = useMemo(() => calcularKgPorSemanaYCampo(filasFiltradas, "label"), [filasFiltradas]);

  // Resumen rápido de contenedores (arribados vs. en agua) + desglose por
  // destino y proyección de llegadas por semana.
  const resumenEstado = useMemo(() => calcularResumenPorEstado(filasFiltradas), [filasFiltradas]);
  const contenedoresPorDestino = useMemo(() => calcularContenedoresPorDestinoYEstado(filasFiltradas), [filasFiltradas]);
  const contenedoresProyectados = useMemo(() => calcularContenedoresProyectadosPorSemana(filasFiltradas), [filasFiltradas]);

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay datos importados. Corre el script de importación.</p>;
  }

  return (
    <div className="space-y-6">
      <FiltrosBar filtros={filtros} opciones={opciones} onChange={setFiltros} onLimpiar={() => setFiltros({})} />

      <KpiCards kpis={kpis} />

      <PremiumConvencionalCard datos={participacionTipo} />

      <EvolucionChart titulo="Evolución Semanal de Facturación" puntos={evolucionSemanal} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DimensionBreakdownChart titulo="Kg exportados por formato" filas={porFormato} />
        <DimensionBreakdownChart titulo="Kg exportados por destino" filas={porDestino} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ParticipacionChart titulo="Participación por destino (kg)" datos={participacionDestino} />
        <ParticipacionChart titulo="Participación por mercado (kg)" datos={participacionMercado} />
      </div>

      <EstadoResumenCards resumen={resumenEstado} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {embarquesPorMercadoSegunModo.map(({ modo, datos }) => (
          <EmbarquesPorMercadoPie key={modo} titulo={`Embarques ${modo.toLowerCase()}s por mercado (kg)`} datos={datos} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StackedBarChart
          titulo="Contenedores por destino según estado"
          descripcion="N° de embarques (PO) por destino: arribados vs. en agua."
          puntos={contenedoresPorDestino.puntos}
          series={contenedoresPorDestino.series}
          formatearValor={(v) => String(Math.round(v))}
        />
        <StackedBarChart
          titulo="Contenedores que se estiman llegar por semana"
          descripcion="N° de embarques (PO) aún en agua, por semana ETA."
          puntos={contenedoresProyectados.puntos}
          series={contenedoresProyectados.series}
          formatearValor={(v) => String(Math.round(v))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PrecioPorKgChart titulo="Precio CIF/kg por variedad" filas={precioPorVariedad} />
        <PrecioPorKgChart titulo="Precio CIF/kg por tipo de producto" filas={precioPorTipo} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StackedBarChart
          titulo="Embarques por semana según estado"
          descripcion="N° de embarques (PO): ATA real para lo arribado, ETA estimado para lo que sigue en agua."
          puntos={embarquesPorSemanaCombinada.puntos}
          series={embarquesPorSemanaCombinada.series}
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
    </div>
  );
}
