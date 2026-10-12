"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import type { FilaDimension } from "@/lib/facturacion-exportacion";

// Barras horizontales de kg exportados por una dimensión (cliente, mercado,
// destino o formato) — genérico: no sabe qué dimensión está mostrando, solo
// recibe las filas ya agrupadas (ver agruparPorDimension en
// lib/facturacion-exportacion.ts) y el título a mostrar.
export function DimensionBreakdownChart({ titulo, filas }: { titulo: string; filas: FilaDimension[] }) {
  const alto = Math.max(120, filas.length * 36 + 20);

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
              <BarChart data={filas} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatCantidad(v)} fontSize={12} />
                <YAxis type="category" dataKey="etiqueta" width={140} fontSize={12} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "netWeight"
                      ? [`${formatCantidad(Number(value))} kg`, "Kg"]
                      : [formatMoneda(Number(value), "USD"), "Facturado"]
                  }
                />
                <Bar dataKey="netWeight" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
