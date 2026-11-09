"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { SectionCard } from "@/components/ui/cards/section-card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara, COLOR_GRILLA, COLOR_EJE, ESTILO_LEYENDA, GROSOR_MAX_BARRA } from "./colores";
import type { PuntoApilado } from "@/lib/facturacion-exportacion";

// Forma de barra para una pila: SOLO el segmento que de verdad queda
// arriba en ESA categoría (el último de `series`, en orden de apilado,
// que tenga valor > 0 ahí) se dibuja con esquinas superiores
// redondeadas; todos los demás van 100% rectos, sin radio — no "tapados
// por el de arriba" (eso rompía en el hover: al bajar la opacidad del
// segmento de abajo, se veía su propia esquina redondeada "escondida",
// como si la barra estuviera partida en dos). Reemplaza tanto `shape`
// (estado normal) como `activeBar` (hover) con la misma lógica, solo
// cambiando la opacidad.
function formaSuperiorSegunTope(series: string[], dataKeyActual: string, radioPx: number, fillOpacity = 1) {
  function FormaSuperior(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: Record<string, unknown> }) {
    const { x = 0, y = 0, width = 0, height = 0, fill, payload } = props;
    if (width <= 0 || height <= 0) return <g />;
    const serieTope = [...series].reverse().find((s) => Number(payload?.[s] ?? 0) > 0);
    const r = serieTope === dataKeyActual ? Math.max(0, Math.min(radioPx, width / 2, height)) : 0;
    if (r <= 0) {
      return <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={fillOpacity} />;
    }
    const d = `M${x},${y + r} A${r},${r} 0 0 1 ${x + r},${y} L${x + width - r},${y} A${r},${r} 0 0 1 ${x + width},${y + r} L${x + width},${y + height} L${x},${y + height} Z`;
    return <path d={d} fill={fill} fillOpacity={fillOpacity} />;
  }
  return FormaSuperior;
}

// Tooltip a medida: a diferencia del "formatter" por defecto de recharts,
// que muestra una fila por cada serie declarada aunque valga 0 (ej. "En
// tránsito: 0" en una semana donde todo arribó), este arma la lista de
// filas él mismo y se salta las series en 0 — solo aparecen las que
// realmente tienen algo esa semana.
function ContenidoTooltip({
  active,
  payload,
  label,
  series,
  fmt,
  mostrarSerie,
  ocultarPorcentaje,
  formatearCategoria,
}: TooltipContentProps & {
  series: string[];
  fmt: (v: number) => string;
  mostrarSerie: (s: string) => string;
  ocultarPorcentaje: boolean;
  formatearCategoria?: (c: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload as PuntoApilado | undefined;
  const total = fila ? series.reduce((acc, s) => acc + Number(fila[s] ?? 0), 0) : 0;
  const entradas = payload.filter((p) => Number(p.value) !== 0);
  if (entradas.length === 0) return null;
  // Valorizado facturado total de la categoría (semana), si el punto lo
  // trae — solo calcularEmbarquesCombinadoPorSemana lo incluye hoy.
  const valorFacturado = typeof fila?.invoicedAmount === "number" ? fila.invoicedAmount : null;

  return (
    <div className="rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{formatearCategoria ? formatearCategoria(String(label)) : label}</p>
      {entradas.map((p) => {
        const valor = Number(p.value);
        const pctTexto = ocultarPorcentaje || total === 0 ? "" : ` (${((valor / total) * 100).toFixed(1)}%)`;
        const n = fila?.[`${p.dataKey}__n`];
        const nTexto = typeof n === "number" ? ` · ${n} embarque${n === 1 ? "" : "s"}` : "";
        return (
          <p key={String(p.dataKey)} style={{ color: p.color }}>
            {mostrarSerie(String(p.dataKey))}: {fmt(valor)}
            {pctTexto}
            {nTexto}
          </p>
        );
      })}
      {valorFacturado !== null && (
        <p className="mt-1 text-muted-foreground">Valorizado Facturado: {formatMoneda(valorFacturado, "USD")}</p>
      )}
    </div>
  );
}

// Barras apiladas genéricas: no sabe qué está agrupando (mercado, semana,
// estado, etc.) — solo recibe los puntos ya armados (ver las funciones
// contarEmbarquesPor*/calcularKgPorSemanaYCampo en
// lib/facturacion-exportacion.ts) y la lista de series a apilar, que sale
// de los valores reales presentes en los datos.
export function StackedBarChart({
  titulo,
  descripcion,
  puntos,
  series,
  formatearValor,
  etiquetaSerie,
  ocultarPorcentaje = false,
  formatearCategoria,
  bordeSuperiorPx,
}: {
  titulo: string;
  descripcion?: string;
  puntos: PuntoApilado[];
  series: string[];
  formatearValor?: (v: number) => string;
  /** Texto más amigable para una serie (ej. "ARRIBADO" -> "Arribado (ATA)"). Por defecto se muestra el nombre de la serie tal cual. */
  etiquetaSerie?: (serie: string) => string;
  /** Quita el "(X% del total de esa barra)" del tooltip. Por defecto se muestra. */
  ocultarPorcentaje?: boolean;
  /** Texto más amigable para la categoría del eje X en el tooltip (ej. "37" -> "W37"). Por defecto se muestra tal cual. */
  formatearCategoria?: (categoria: string) => string;
  /**
   * Redondea solo las esquinas superiores del segmento que de verdad
   * queda arriba en cada categoría (ver formaSuperiorSegunTope) — el
   * resto de la pila va recta, incluso en hover. Opt-in: por defecto el
   * gráfico queda con esquinas rectas en todos sus segmentos.
   */
  bordeSuperiorPx?: number;
}) {
  const fmt = formatearValor ?? ((v: number) => formatCantidad(v));
  const mostrarSerie = etiquetaSerie ?? ((s: string) => s);

  return (
    <SectionCard title={titulo} description={descripcion}>
      {puntos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={puntos} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
              <XAxis dataKey="categoria" interval={0} fontSize={16} stroke={COLOR_EJE} tickLine={false} />
              <YAxis tickFormatter={fmt} fontSize={16} stroke={COLOR_EJE} tickLine={false} axisLine={false} />
              <Tooltip
                content={(props) => (
                  <ContenidoTooltip
                    {...props}
                    series={series}
                    fmt={fmt}
                    mostrarSerie={mostrarSerie}
                    ocultarPorcentaje={ocultarPorcentaje}
                    formatearCategoria={formatearCategoria}
                  />
                )}
              />
              <Legend formatter={mostrarSerie} wrapperStyle={ESTILO_LEYENDA} />
              {series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="a"
                  fill={colorPara(s, i)}
                  maxBarSize={GROSOR_MAX_BARRA}
                  shape={bordeSuperiorPx ? formaSuperiorSegunTope(series, s, bordeSuperiorPx) : undefined}
                  activeBar={bordeSuperiorPx ? formaSuperiorSegunTope(series, s, bordeSuperiorPx, 0.85) : { fillOpacity: 0.85 }}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}
