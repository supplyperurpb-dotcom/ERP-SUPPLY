"use client";

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SectionCard } from "@/components/ui/cards/section-card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_SOBRIA, COLOR_GRILLA, COLOR_EJE, ESTILO_LEYENDA, GROSOR_MAX_BARRA } from "./colores";
import type { PuntoEvolucionPrecio } from "@/lib/facturacion-exportacion";

// Mismos colores que las tarjetas KPI: azul claro para Facturado, plomo
// claro para Liquidado — para que se lea como la misma historia.
const AZUL = PALETA_SOBRIA[1];
const GRIS = PALETA_SOBRIA[2];
// Verde salvia para los Kg Liquidados: distinto de los dos tonos de
// precio de arriba, para no confundirlo con ninguna de las dos líneas.
const VERDE = PALETA_SOBRIA[4];

const ETIQUETA_SERIE: Record<string, string> = {
  puFacturado: "PU CIF Facturado",
  puLiquidado: "PU CIF Liquidado",
  kgLiquidado: "Kg Liquidado",
};

// Evolución semanal del precio unitario CIF (facturado y liquidado), con
// los kg de cada uno en el tooltip y la semana mostrada como "W<n>" al
// pasar el cursor. Genérico: no calcula nada, solo dibuja los puntos que
// ya le llegan de calcularEvolucionPrecioSemanal (lib/facturacion-exportacion.ts).
export function EvolucionPrecioChart({
  titulo,
  descripcion,
  puntos,
}: {
  titulo: string;
  descripcion?: string;
  puntos: PuntoEvolucionPrecio[];
}) {
  return (
    <SectionCard title={titulo} description={descripcion}>
      {puntos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={puntos} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
              <XAxis dataKey="semana" interval={0} fontSize={12} stroke={COLOR_EJE} tickLine={false} />
              <YAxis
                yAxisId="precio"
                tickFormatter={(v) => formatMoneda(v, "USD")}
                fontSize={12}
                stroke={COLOR_EJE}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="kg"
                orientation="right"
                tickFormatter={(v) => formatCantidad(v)}
                fontSize={12}
                stroke={VERDE}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(label) => `W${label}`}
                formatter={(value, name, item) => {
                  const etiqueta = ETIQUETA_SERIE[String(name)] ?? String(name);
                  if (value === null || value === undefined) return ["Sin datos esa semana", etiqueta];
                  if (name === "kgLiquidado") return [`${formatCantidad(Number(value))} Kg`, etiqueta];
                  const payload = item?.payload as PuntoEvolucionPrecio | undefined;
                  const kg = name === "puFacturado" ? payload?.kgFacturado : payload?.kgLiquidado;
                  return [`${formatMoneda(Number(value), "USD")} (${formatCantidad(kg ?? 0)} Kg)`, etiqueta];
                }}
              />
              <Legend formatter={(value) => ETIQUETA_SERIE[value] ?? value} wrapperStyle={ESTILO_LEYENDA} />
              {/* Barras primero para que las líneas de precio queden
                  encima; opacidad reducida y eje propio (a la derecha, en
                  el mismo tono verde) para que no se lean como si
                  compartieran escala con el precio. */}
              <Bar
                yAxisId="kg"
                dataKey="kgLiquidado"
                fill={VERDE}
                fillOpacity={0.55}
                radius={[8, 8, 0, 0]}
                maxBarSize={GROSOR_MAX_BARRA}
                activeBar={{ fillOpacity: 0.8 }}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="precio"
                type="monotone"
                dataKey="puFacturado"
                stroke={AZUL}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
              />
              <Line
                yAxisId="precio"
                type="monotone"
                dataKey="puLiquidado"
                stroke={GRIS}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}
