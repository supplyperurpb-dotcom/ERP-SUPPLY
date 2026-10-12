"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatMoneda, formatCantidad } from "@/lib/utils";

type Fila = {
  dispWeek: number;
  invoicedAmount: number;
  cifLiquidatedTariffs: number;
  netWeight: number;
  netKilosLiquidated: number;
};

const TODAS_LAS_SEMANAS = "__todas__";

export function DashboardExportacionesView({ filas }: { filas: Fila[] }) {
  const semanas = useMemo(() => [...new Set(filas.map((f) => f.dispWeek))].sort((a, b) => a - b), [filas]);
  const [semana, setSemana] = useState(TODAS_LAS_SEMANAS);

  const filasFiltradas = semana === TODAS_LAS_SEMANAS ? filas : filas.filter((f) => f.dispWeek === Number(semana));

  const totales = filasFiltradas.reduce(
    (acc, f) => ({
      invoicedAmount: acc.invoicedAmount + f.invoicedAmount,
      cifLiquidatedTariffs: acc.cifLiquidatedTariffs + f.cifLiquidatedTariffs,
      netWeight: acc.netWeight + f.netWeight,
      netKilosLiquidated: acc.netKilosLiquidated + f.netKilosLiquidated,
    }),
    { invoicedAmount: 0, cifLiquidatedTariffs: 0, netWeight: 0, netKilosLiquidated: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="max-w-xs space-y-2">
        <Label>Semana de despacho</Label>
        <Select value={semana} onValueChange={setSemana}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_LAS_SEMANAS}>Todas las semanas</SelectItem>
            {semanas.map((s) => (
              <SelectItem key={s} value={String(s)}>
                Semana {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total facturado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoneda(totales.invoicedAmount, "USD")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total liquidado valorizado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoneda(totales.cifLiquidatedTariffs, "USD")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kg totales embarcados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCantidad(totales.netWeight)} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kg liquidados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCantidad(totales.netKilosLiquidated)} kg</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
