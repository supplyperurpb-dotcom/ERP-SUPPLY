import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import type { ResumenImpactoLiquidacion } from "@/lib/facturacion-exportacion";

// Cuadro resumen aparte del gráfico de Evolución Semanal de Precios:
// cuánto se ganó o perdió, semana a semana, por liquidar a un precio
// distinto del facturado (diferencia de PU × Kg liquidados). Datos ya
// calculados por calcularImpactoLiquidacion (lib/facturacion-exportacion.ts).
export function ImpactoLiquidacionCard({ resumen }: { resumen: ResumenImpactoLiquidacion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impacto De Liquidación Vs. Facturado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {resumen.porSemana.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay semanas liquidadas para comparar.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pérdida Total</p>
                <p className="text-xl font-semibold text-red-600">– {formatMoneda(resumen.totalPerdida, "USD")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ganancia Total</p>
                <p className="text-xl font-semibold text-green-600">+ {formatMoneda(resumen.totalGanancia, "USD")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Neto</p>
                <p className={`text-xl font-semibold ${resumen.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {resumen.neto >= 0 ? "+" : ""}
                  {formatMoneda(resumen.neto, "USD")}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead className="text-right">PU CIF Facturado</TableHead>
                  <TableHead className="text-right">PU CIF Liquidado</TableHead>
                  <TableHead className="text-right">Diferencia/Kg</TableHead>
                  <TableHead className="text-right">Kg Liquidados</TableHead>
                  <TableHead className="text-right">Impacto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.porSemana.map((f) => (
                  <TableRow key={f.semana}>
                    <TableCell>W{f.semana}</TableCell>
                    <TableCell className="text-right">{formatMoneda(f.puFacturado, "USD")}</TableCell>
                    <TableCell className="text-right">{formatMoneda(f.puLiquidado, "USD")}</TableCell>
                    <TableCell className={`text-right ${f.diferenciaPorKg < 0 ? "text-red-600" : "text-green-600"}`}>
                      {f.diferenciaPorKg >= 0 ? "+" : ""}
                      {formatMoneda(f.diferenciaPorKg, "USD")}
                    </TableCell>
                    <TableCell className="text-right">{formatCantidad(f.kgLiquidado)} Kg</TableCell>
                    <TableCell className={`text-right font-medium ${f.impactoUsd < 0 ? "text-red-600" : "text-green-600"}`}>
                      {f.impactoUsd >= 0 ? "+" : ""}
                      {formatMoneda(f.impactoUsd, "USD")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
