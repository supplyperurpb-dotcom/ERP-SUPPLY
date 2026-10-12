"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda } from "@/lib/utils";
import type { FilaPrecioPorKg } from "@/lib/facturacion-exportacion";

// Barras horizontales de $CIF/kg promedio ponderado por variedad o tipo —
// genérico, solo dibuja lo que ya le llega de calcularPrecioPorKg.
export function PrecioPorKgChart({ titulo, filas }: { titulo: string; filas: FilaPrecioPorKg[] }) {
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
                <XAxis type="number" tickFormatter={(v) => formatMoneda(v, "USD")} fontSize={12} />
                <YAxis type="category" dataKey="etiqueta" width={110} fontSize={12} />
                <Tooltip formatter={(value) => [formatMoneda(Number(value), "USD"), "CIF/kg"]} />
                <Bar dataKey="cifPorKg" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
