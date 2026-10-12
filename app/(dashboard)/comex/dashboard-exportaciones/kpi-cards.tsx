import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import type { KpisFacturacion } from "@/lib/facturacion-exportacion";

// Puramente presentacional: solo pinta los 4 números que le llegan por
// props. Toda la cuenta (sumas, filtros) vive en lib/facturacion-exportacion.ts.
export function KpiCards({ kpis }: { kpis: KpisFacturacion }) {
  const tarjetas = [
    { titulo: "Total facturado", valor: formatMoneda(kpis.invoicedAmount, "USD") },
    { titulo: "Total liquidado valorizado", valor: formatMoneda(kpis.cifLiquidatedTariffs, "USD") },
    { titulo: "Kg totales embarcados", valor: `${formatCantidad(kpis.netWeight)} kg` },
    { titulo: "Kg liquidados", valor: `${formatCantidad(kpis.netKilosLiquidated)} kg` },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <Card key={t.titulo}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{t.valor}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
