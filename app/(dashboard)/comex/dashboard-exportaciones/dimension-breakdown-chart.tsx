"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_SOBRIA, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { FilaDimension } from "@/lib/facturacion-exportacion";

// Barras horizontales de kg exportados por una dimensión (cliente, mercado,
// destino o formato) — genérico: no sabe qué dimensión está mostrando, solo
// recibe las filas ya agrupadas (ver agruparPorDimension en
// lib/facturacion-exportacion.ts) y el título a mostrar. El % de
// representación de cada barra se calcula acá mismo, sobre el total de
// las filas que le llegan (ya filtradas).
export function DimensionBreakdownChart({
  titulo,
  filas,
  mostrarEmbarques = true,
}: {
  titulo: string;
  filas: FilaDimension[];
  /** "Kg exportados por formato" no muestra embarques en el tooltip (una misma PO reparte varios formatos, así que ese conteo no es útil ahí). */
  mostrarEmbarques?: boolean;
}) {
  const alto = Math.max(120, filas.length * 36 + 20);
  const totalKg = filas.reduce((acc, f) => acc + f.netWeight, 0);
  const datos = filas.map((f) => ({ ...f, participacionPct: totalKg > 0 ? (f.netWeight / totalKg) * 100 : 0 }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div style={{ height: alto }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} horizontal={false} />
                <XAxis type="number" tick={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="etiqueta" width={140} fontSize={12} stroke={COLOR_EJE} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const payload = item?.payload as (FilaDimension & { participacionPct: number }) | undefined;
                    const pctTexto = payload ? ` (${payload.participacionPct.toFixed(1)}%)` : "";
                    const embarquesTexto =
                      payload && mostrarEmbarques
                        ? ` · ${payload.embarques} embarque${payload.embarques === 1 ? "" : "s"}`
                        : "";
                    return name === "netWeight"
                      ? [`${formatCantidad(Number(value))} Kg${pctTexto}${embarquesTexto}`, "Kg"]
                      : [formatMoneda(Number(value), "USD"), "Facturado"];
                  }}
                />
                <Bar dataKey="netWeight" fill={PALETA_SOBRIA[0]} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="participacionPct"
                    position="right"
                    formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "")}
                    fontSize={12}
                    fill={COLOR_EJE}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
