"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad } from "@/lib/utils";
import type { Participacion } from "@/lib/facturacion-exportacion";

const COLORES = ["#1d4ed8", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

// Torta de participación (kg y %) de cada valor de una dimensión sobre el
// total del filtro actual — genérica, solo dibuja lo que ya viene
// calculado en calcularParticipacion (lib/facturacion-exportacion.ts). Las
// etiquetas se muestran en mayúsculas por prolijidad visual (el dato
// original, p. ej. para Tooltip, no se toca).
export function ParticipacionChart({ titulo, datos }: { titulo: string; datos: Participacion[] }) {
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
                  label={({ name, value, percent }: { name?: string; value?: number; percent?: number }) =>
                    `${(name ?? "").toUpperCase()}: ${formatCantidad(value ?? 0)} kg (${((percent ?? 0) * 100).toFixed(1)}%)`
                  }
                  labelLine
                >
                  {datos.map((d, i) => (
                    <Cell key={d.etiqueta} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${formatCantidad(Number(value))} kg`} />
                <Legend formatter={(value) => String(value).toUpperCase()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
