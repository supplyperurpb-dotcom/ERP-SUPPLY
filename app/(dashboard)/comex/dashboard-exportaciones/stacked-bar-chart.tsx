"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { PuntoApilado } from "@/lib/facturacion-exportacion";

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
      {valorFacturado !== null && (
        <p className="mb-1 text-muted-foreground">Valorizado facturado: {formatMoneda(valorFacturado, "USD")}</p>
      )}
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
}) {
  const fmt = formatearValor ?? ((v: number) => formatCantidad(v));
  const mostrarSerie = etiquetaSerie ?? ((s: string) => s);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </CardHeader>
      <CardContent>
        {puntos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
                <XAxis dataKey="categoria" interval={0} fontSize={12} stroke={COLOR_EJE} tickLine={false} />
                <YAxis tickFormatter={fmt} fontSize={12} stroke={COLOR_EJE} tickLine={false} axisLine={false} />
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
                <Legend formatter={mostrarSerie} />
                {series.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={colorPara(s, i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
