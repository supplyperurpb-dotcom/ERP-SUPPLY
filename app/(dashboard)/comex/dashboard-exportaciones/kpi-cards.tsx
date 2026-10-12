import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import type { KpisFacturacion } from "@/lib/facturacion-exportacion";

// Puramente presentacional: solo pinta los números que le llegan por
// props (y el $/kg, que es pura división de dos de ellos, no una cifra de
// negocio nueva). Toda la suma/filtro vive en lib/facturacion-exportacion.ts.
export function KpiCards({ kpis }: { kpis: KpisFacturacion }) {
  const cifPorKg = kpis.netWeight > 0 ? kpis.invoicedAmount / kpis.netWeight : 0;
  const cifPorKgLiquidado = kpis.netKilosLiquidated > 0 ? kpis.cifLiquidatedTariffs / kpis.netKilosLiquidated : 0;

  const tarjetas = [
    {
      titulo: "Kg Embarcados",
      kg: `${formatCantidad(kpis.netWeight)} kg`,
      valor: formatMoneda(kpis.invoicedAmount, "USD"),
      porKg: `${formatMoneda(cifPorKg, "USD")} /kg CIF`,
    },
    {
      titulo: "Kg Liquidados",
      kg: `${formatCantidad(kpis.netKilosLiquidated)} kg`,
      valor: formatMoneda(kpis.cifLiquidatedTariffs, "USD"),
      porKg: `${formatMoneda(cifPorKgLiquidado, "USD")} /kg CIF liquidado`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {tarjetas.map((t) => (
        <Card key={t.titulo}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.titulo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{t.kg}</p>
            <p className="text-base font-medium text-foreground">{t.valor}</p>
            <p className="text-sm text-muted-foreground">{t.porKg}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
