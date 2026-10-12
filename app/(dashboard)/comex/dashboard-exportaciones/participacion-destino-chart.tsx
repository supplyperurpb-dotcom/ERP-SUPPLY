"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad } from "@/lib/utils";
import type { Participacion } from "@/lib/facturacion-exportacion";

const COLORES = ["#1d4ed8", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

// Torta de participación de cada destino sobre el total de kg del filtro
// actual — genérica, solo dibuja lo que ya viene calculado en
// calcularParticipacionPorDestino.
export function ParticipacionDestinoChart({ datos }: { datos: Participacion[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Participación por destino (kg)</CardTitle>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datos}
                  dataKey="netWeight"
                  nameKey="etiqueta"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                >
                  {datos.map((d, i) => (
                    <Cell key={d.etiqueta} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${formatCantidad(Number(value))} kg`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
