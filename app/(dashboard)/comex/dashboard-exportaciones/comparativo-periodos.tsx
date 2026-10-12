import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import type { KpisFacturacion } from "@/lib/facturacion-exportacion";

type FilaComparativa = {
  etiqueta: string;
  formatear: (n: number) => string;
  a: number;
  b: number;
};

function variacion(a: number, b: number): string {
  if (a === 0) return b === 0 ? "—" : "+∞%";
  const pct = ((b - a) / a) * 100;
  const signo = pct > 0 ? "+" : "";
  return `${signo}${pct.toFixed(1)}%`;
}

// Tabla comparativa entre dos periodos (A y B) — genérica, solo recibe los
// 2 KPIs ya calculados (uno por periodo) y sus etiquetas; la variación %
// se calcula acá mismo porque es puro display, no una cifra de negocio
// nueva.
export function ComparativoPeriodos({
  etiquetaA,
  etiquetaB,
  kpisA,
  kpisB,
}: {
  etiquetaA: string;
  etiquetaB: string;
  kpisA: KpisFacturacion;
  kpisB: KpisFacturacion;
}) {
  const filas: FilaComparativa[] = [
    { etiqueta: "Total facturado", formatear: (n) => formatMoneda(n, "USD"), a: kpisA.invoicedAmount, b: kpisB.invoicedAmount },
    {
      etiqueta: "Total liquidado valorizado",
      formatear: (n) => formatMoneda(n, "USD"),
      a: kpisA.cifLiquidatedTariffs,
      b: kpisB.cifLiquidatedTariffs,
    },
    { etiqueta: "Kg totales embarcados", formatear: (n) => `${formatCantidad(n)} kg`, a: kpisA.netWeight, b: kpisB.netWeight },
    {
      etiqueta: "Kg liquidados",
      formatear: (n) => `${formatCantidad(n)} kg`,
      a: kpisA.netKilosLiquidated,
      b: kpisB.netKilosLiquidated,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparativo entre periodos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicador</TableHead>
              <TableHead className="text-right">{etiquetaA}</TableHead>
              <TableHead className="text-right">{etiquetaB}</TableHead>
              <TableHead className="text-right">Variación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.etiqueta}>
                <TableCell className="font-medium">{f.etiqueta}</TableCell>
                <TableCell className="text-right">{f.formatear(f.a)}</TableCell>
                <TableCell className="text-right">{f.formatear(f.b)}</TableCell>
                <TableCell className="text-right">{variacion(f.a, f.b)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
