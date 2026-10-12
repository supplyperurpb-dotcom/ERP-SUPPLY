"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_SOBRIA, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { PuntoEvolucion } from "@/lib/facturacion-exportacion";

// Evolución (semanal o mensual, según qué le pase el padre): barras de kg
// embarcados en el eje izquierdo, línea de facturado (USD) en el eje
// derecho. Genérico — no calcula nada, solo dibuja los puntos que ya le
// llegan ordenados cronológicamente.
export function EvolucionChart({ titulo, puntos }: { titulo: string; puntos: PuntoEvolucion[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {puntos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
                <XAxis dataKey="periodo" interval={0} fontSize={12} stroke={COLOR_EJE} tickLine={false} />
                <YAxis yAxisId="kg" tickFormatter={(v) => formatCantidad(v)} fontSize={12} stroke={COLOR_EJE} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="usd"
                  orientation="right"
                  tickFormatter={(v) => formatCantidad(v)}
                  fontSize={12}
                  stroke={COLOR_EJE}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "netWeight"
                      ? [`${formatCantidad(Number(value))} kg`, "Kg embarcados"]
                      : [formatMoneda(Number(value), "USD"), "Facturado"]
                  }
                />
                <Legend formatter={(value) => (value === "netWeight" ? "Kg embarcados" : "Facturado (USD)")} />
                <Bar yAxisId="kg" dataKey="netWeight" fill={PALETA_SOBRIA[2]} radius={[4, 4, 0, 0]} />
                <Line yAxisId="usd" type="monotone" dataKey="invoicedAmount" stroke={PALETA_SOBRIA[0]} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
