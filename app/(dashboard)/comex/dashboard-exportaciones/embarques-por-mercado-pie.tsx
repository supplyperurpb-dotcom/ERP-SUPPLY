"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara } from "./colores";
import type { FilaPieMercado } from "@/lib/facturacion-exportacion";

// Torta de kg por mercado para un modo de transporte (AEREO o MARITIMO) —
// la partición de cada porción es por kg, pero el tooltip muestra también
// el n° de contenedores (PO distintas) y el valor facturado de ese
// mercado (ver calcularEmbarquesPorMercadoSegunModo en
// lib/facturacion-exportacion.ts).
export function EmbarquesPorMercadoPie({ titulo, datos }: { titulo: string; datos: FilaPieMercado[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datos}
                  dataKey="netWeight"
                  nameKey="etiqueta"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  paddingAngle={3}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${(name ?? "").toUpperCase()}: ${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                  labelLine
                >
                  {datos.map((d, i) => (
                    <Cell key={d.etiqueta} fill={colorPara(d.etiqueta, i)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(_value, _name, item) => {
                    const d = item?.payload as FilaPieMercado | undefined;
                    if (!d) return "";
                    const texto = `${formatCantidad(d.netWeight)} kg (${d.participacionPct.toFixed(1)}%) · ${d.n} contenedor${
                      d.n === 1 ? "" : "es"
                    } · ${formatMoneda(d.invoicedAmount, "USD")}`;
                    return [texto, d.etiqueta.toUpperCase()];
                  }}
                />
                <Legend formatter={(value) => String(value).toUpperCase()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
