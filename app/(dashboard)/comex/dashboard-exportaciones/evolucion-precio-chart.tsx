"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_SOBRIA, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { PuntoEvolucionPrecio } from "@/lib/facturacion-exportacion";

// Mismos colores que las tarjetas KPI: azul claro para Facturado, plomo
// claro para Liquidado — para que se lea como la misma historia.
const AZUL = PALETA_SOBRIA[1];
const GRIS = PALETA_SOBRIA[2];

const ETIQUETA_SERIE: Record<string, string> = {
  puFacturado: "PU CIF Facturado",
  puLiquidado: "PU CIF Liquidado",
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
              <LineChart data={puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
                <XAxis dataKey="semana" interval={0} fontSize={12} stroke={COLOR_EJE} tickLine={false} />
                <YAxis tickFormatter={(v) => formatMoneda(v, "USD")} fontSize={12} stroke={COLOR_EJE} tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={(label) => `W${label}`}
                  formatter={(value, name, item) => {
                    const etiqueta = ETIQUETA_SERIE[String(name)] ?? String(name);
                    if (value === null || value === undefined) return ["Sin datos esa semana", etiqueta];
                    const payload = item?.payload as PuntoEvolucionPrecio | undefined;
                    const kg = name === "puFacturado" ? payload?.kgFacturado : payload?.kgLiquidado;
                    return [`${formatMoneda(Number(value), "USD")} (${formatCantidad(kg ?? 0)} Kg)`, etiqueta];
                  }}
                />
                <Legend formatter={(value) => ETIQUETA_SERIE[value] ?? value} />
                <Line type="monotone" dataKey="puFacturado" stroke={AZUL} strokeWidth={2} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="puLiquidado" stroke={GRIS} strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
