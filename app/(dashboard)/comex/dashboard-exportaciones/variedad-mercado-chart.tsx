"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { FilaVariedadMercado } from "@/lib/facturacion-exportacion";

type Punto = { variedad: string; totalKg: number; [clave: string]: string | number };

// Tooltip a medida: el valor que dibuja la barra es el % (para que todas
// las barras lleguen a 100 y se puedan comparar) — el kg real no se
// muestra acá, solo el %. El PU CIF y el n° de embarques viajan junto a
// cada punto como "<mercado>__pu"/"__n".
function ContenidoTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload as Punto | undefined;
  const entradas = payload.filter((p) => Number(p.value) > 0);
  if (!fila || entradas.length === 0) return null;

  return (
    <div className="rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {entradas.map((p) => {
        const mercado = String(p.dataKey);
        const pu = fila[`${mercado}__pu`];
        const n = fila[`${mercado}__n`];
        return (
          <p key={mercado} style={{ color: p.color }}>
            {mercado}: {Number(p.value).toFixed(0)}%
            {typeof pu === "number" ? ` · PU CIF Fact.: ${formatMoneda(pu, "USD")}` : ""}
            {typeof n === "number" ? ` · ${n} embarque${n === 1 ? "" : "s"}` : ""}
          </p>
        );
      })}
    </div>
  );
}

// Kg exportados por variedad, apilado por mercado — barras 100% apiladas:
// todas llegan a la misma altura, cada segmento mide según el % que ese
// mercado representa dentro de la variedad (no el kg absoluto). El total
// real de kg va encima de la barra y, al pasar el cursor, el kg real y el
// PU CIF facturado de cada mercado — datos ya calculados por
// calcularExportacionesPorVariedadYMercado (lib/facturacion-exportacion.ts).
export function VariedadMercadoChart({ titulo, datos }: { titulo: string; datos: FilaVariedadMercado[] }) {
  // De mayor a menor kg total (sumado entre todas las variedades) — así el
  // mercado más grande (típicamente DOTA) queda abajo en la barra y con el
  // color más oscuro de la paleta (colorPara asigna por posición acá).
  const totalPorMercado = new Map<string, number>();
  for (const f of datos) {
    for (const s of f.porMercado) {
      totalPorMercado.set(s.mercado, (totalPorMercado.get(s.mercado) ?? 0) + s.kg);
    }
  }
  const series = [...totalPorMercado.entries()].sort((a, b) => b[1] - a[1]).map(([mercado]) => mercado);
  const puntos: Punto[] = datos.map((f) => {
    const punto: Punto = { variedad: f.variedad, totalKg: f.totalKg };
    for (const s of f.porMercado) {
      punto[s.mercado] = s.pct;
      punto[`${s.mercado}__pu`] = s.puCifFacturado;
      punto[`${s.mercado}__n`] = s.embarques;
    }
    return punto;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {puntos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={puntos} margin={{ top: 30, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
                <XAxis dataKey="variedad" fontSize={12} stroke={COLOR_EJE} tickLine={false} />
                <YAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
                <Tooltip content={(props) => <ContenidoTooltip {...props} />} />
                <Legend />
                {series.map((mercado, i) => (
                  <Bar key={mercado} dataKey={mercado} stackId="a" fill={colorPara(mercado, i)}>
                    <LabelList
                      dataKey={mercado}
                      position="center"
                      formatter={(v) => (typeof v === "number" && v > 0 ? `${v.toFixed(0)}%` : "")}
                      fill="#fff"
                      fontSize={12}
                    />
                    {i === series.length - 1 && (
                      <LabelList
                        dataKey="totalKg"
                        position="top"
                        formatter={(v) => (typeof v === "number" ? `${formatCantidad(v)} Kg` : "")}
                        fontSize={12}
                        fill={COLOR_EJE}
                      />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
