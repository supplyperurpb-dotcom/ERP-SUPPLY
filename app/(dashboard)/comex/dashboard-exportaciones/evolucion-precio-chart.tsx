"use client";

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { SectionCard } from "@/components/ui/cards/section-card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { colorPara, PALETA_SOBRIA, COLOR_GRILLA, COLOR_EJE, ESTILO_LEYENDA, GROSOR_MAX_BARRA } from "./colores";
import type { PuntoEvolucionPrecio } from "@/lib/facturacion-exportacion";

// Mismos colores que las tarjetas KPI: azul claro para Facturado, plomo
// claro para Liquidado — para que se lea como la misma historia.
const AZUL = PALETA_SOBRIA[1];
const GRIS = PALETA_SOBRIA[2];
// Premium/Convencional: mismos tonos semánticos que "Kg por semana de
// despacho según tipo de producto" (ver COLOR_SEMANTICO en colores.ts).
const COLOR_PREMIUM = colorPara("PREMIUM", 0);
const COLOR_CONVENCIONAL = colorPara("CONVENCIONAL", 1);
// Terminal Market y Non Fresh comparten un único color en la barra (pedido
// explícito, 2026-11-17): son canales de menor valor que no interesa
// diferenciar a simple vista, solo en el detalle del tooltip.
const COLOR_TM_NF = PALETA_SOBRIA[4];

const ETIQUETA_SERIE: Record<string, string> = {
  puFacturado: "PU CIF Facturado",
  puLiquidado: "PU CIF Liquidado",
  kgPremium: "PL = Premium",
  kgConvencional: "YL = Convencional",
  kgTerminalMarket: "TM = Terminal Market",
  kgNonFresh: "NF = Non Fresh",
};

// Orden de la leyenda (pedido explícito, 2026-11-17): YL, PL, TM, NF y
// recién después las 2 líneas de precio — independiente del orden de
// apilado de las barras (Premium abajo, Convencional, Terminal Market,
// Non Fresh arriba), que no cambia. Recharts 3 ya no expone `payload`
// como prop pública de <Legend>, así que el orden se fija con un
// `content` propio en vez de reordenar las series del chart.
const LEYENDA_ITEMS: { dataKey: string; tipo: "square" | "line"; color: string }[] = [
  { dataKey: "kgConvencional", tipo: "square", color: COLOR_CONVENCIONAL },
  { dataKey: "kgPremium", tipo: "square", color: COLOR_PREMIUM },
  { dataKey: "kgTerminalMarket", tipo: "square", color: COLOR_TM_NF },
  { dataKey: "kgNonFresh", tipo: "square", color: COLOR_TM_NF },
  { dataKey: "puFacturado", tipo: "line", color: AZUL },
  { dataKey: "puLiquidado", tipo: "line", color: GRIS },
];

function ContenidoLeyenda() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[13px]">
      {LEYENDA_ITEMS.map((item) => (
        <li key={item.dataKey} className="flex items-center gap-1.5">
          {item.tipo === "square" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          ) : (
            <span className="inline-block h-0.5 w-3.5" style={{ backgroundColor: item.color }} />
          )}
          <span>{ETIQUETA_SERIE[item.dataKey]}</span>
        </li>
      ))}
    </ul>
  );
}

const FILAS_DESGLOSE: {
  etiqueta: string;
  color: string;
  kg: keyof PuntoEvolucionPrecio;
  precio: keyof PuntoEvolucionPrecio;
}[] = [
  { etiqueta: "PL", color: COLOR_PREMIUM, kg: "kgPremium", precio: "puLiquidadoPremium" },
  { etiqueta: "YL", color: COLOR_CONVENCIONAL, kg: "kgConvencional", precio: "puLiquidadoConvencional" },
  { etiqueta: "TM", color: COLOR_TM_NF, kg: "kgTerminalMarket", precio: "puLiquidadoTerminalMarket" },
  { etiqueta: "NF", color: COLOR_TM_NF, kg: "kgNonFresh", precio: "puLiquidadoNonFresh" },
];

// Tooltip a medida: primero los 2 precios generales, una línea divisoria,
// el total de Kg Liquidado y recién debajo una tabla con el P. CIF LIQ y
// el % de cada categoría (PL/YL/TM/NF) — pedido explícito, 2026-11-17.
function ContenidoTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0]?.payload as PuntoEvolucionPrecio | undefined;
  if (!punto) return null;

  return (
    <div className="min-w-[220px] rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">W{label}</p>
      <p className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3" style={{ backgroundColor: AZUL }} />
        PU CIF Facturado: {punto.puFacturado === null ? "Sin datos esa semana" : formatMoneda(punto.puFacturado, "USD")}
      </p>
      <p className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3" style={{ backgroundColor: GRIS }} />
        PU CIF Liquidado: {punto.puLiquidado === null ? "Sin datos esa semana" : formatMoneda(punto.puLiquidado, "USD")}
      </p>

      <div className="my-2 border-t" />
      <p className="flex items-center justify-between gap-3 font-medium">
        <span>Total Kg Liquidado</span>
        <span className="tabular-nums">{formatCantidad(punto.kgLiquidado)} Kg</span>
      </p>

      <div className="my-2 border-t" />
      <div className="grid grid-cols-[auto_64px_46px] items-center gap-x-2 border-b pb-1 text-xs uppercase tracking-wide text-muted-foreground">
        <span />
        <span className="text-right">P. CIF LIQ</span>
        <span className="text-center">%</span>
      </div>
      {FILAS_DESGLOSE.map((f) => {
        const kg = Number(punto[f.kg] ?? 0);
        const precio = punto[f.precio] as number | null;
        const pct = punto.kgLiquidado > 0 ? (kg / punto.kgLiquidado) * 100 : 0;
        return (
          <div key={f.etiqueta} className="grid grid-cols-[auto_64px_46px] items-center gap-x-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: f.color }} />
              {f.etiqueta}
            </span>
            <span className="text-right tabular-nums">{precio === null ? "—" : formatMoneda(precio, "USD")}</span>
            <span className="text-right tabular-nums">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Evolución semanal del precio unitario CIF (facturado y liquidado), con el
// Kg Liquidado desglosado en 4 categorías mutuamente excluyentes (PL/YL/TM/
// NF, ver categoriaLiquidacion en lib/facturacion-exportacion.ts). TM y NF
// comparten color en la barra pero se calculan y muestran por separado en
// el tooltip. Genérico: no calcula nada, solo dibuja los puntos que ya le
// llegan de calcularEvolucionPrecioSemanal.
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
                stroke={COLOR_TM_NF}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={(props) => <ContenidoTooltip {...props} />} />
              <Legend content={<ContenidoLeyenda />} wrapperStyle={ESTILO_LEYENDA} />
              {/* Barras primero para que las líneas de precio queden
                  encima; opacidad reducida y eje propio (a la derecha) para
                  que no se lean como si compartieran escala con el precio. */}
              <Bar
                yAxisId="kg"
                dataKey="kgPremium"
                stackId="kg"
                fill={COLOR_PREMIUM}
                fillOpacity={0.85}
                maxBarSize={GROSOR_MAX_BARRA}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                yAxisId="kg"
                dataKey="kgConvencional"
                stackId="kg"
                fill={COLOR_CONVENCIONAL}
                fillOpacity={0.85}
                maxBarSize={GROSOR_MAX_BARRA}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                yAxisId="kg"
                dataKey="kgTerminalMarket"
                stackId="kg"
                fill={COLOR_TM_NF}
                fillOpacity={0.85}
                maxBarSize={GROSOR_MAX_BARRA}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                yAxisId="kg"
                dataKey="kgNonFresh"
                stackId="kg"
                fill={COLOR_TM_NF}
                fillOpacity={0.85}
                radius={[8, 8, 0, 0]}
                maxBarSize={GROSOR_MAX_BARRA}
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
