"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad } from "@/lib/utils";
import type { PuntoApilado } from "@/lib/facturacion-exportacion";

const COLORES = ["#1d4ed8", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

// Barras apiladas genéricas: no sabe qué está agrupando (mercado, semana,
// estado, etc.) — solo recibe los puntos ya armados (ver las funciones
// contarEmbarquesPor*/calcularKgPorSemanaYCampo en
// lib/facturacion-exportacion.ts) y la lista de series a apilar, que sale
// de los valores reales presentes en los datos.
export function StackedBarChart({
  titulo,
  descripcion,
  puntos,
  series,
  formatearValor,
}: {
  titulo: string;
  descripcion?: string;
  puntos: PuntoApilado[];
  series: string[];
  formatearValor?: (v: number) => string;
}) {
  const fmt = formatearValor ?? ((v: number) => formatCantidad(v));

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
              <BarChart data={puntos} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" interval={0} fontSize={12} />
                <YAxis tickFormatter={fmt} fontSize={12} />
                <Tooltip formatter={(value) => fmt(Number(value))} />
                <Legend />
                {series.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={COLORES[i % COLORES.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
