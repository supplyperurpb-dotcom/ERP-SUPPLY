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
      lineaPrincipal: `${formatCantidad(kpis.netWeight)} kg`,
      lineaSecundaria: formatMoneda(kpis.invoicedAmount, "USD"),
    },
    {
      titulo: "$/kg CIF",
      lineaPrincipal: formatMoneda(cifPorKg, "USD"),
    },
    {
      titulo: "Kg Liquidados",
      lineaPrincipal: `${formatCantidad(kpis.netKilosLiquidated)} kg`,
      lineaSecundaria: formatMoneda(kpis.cifLiquidatedTariffs, "USD"),
    },
    {
      titulo: "$/kg CIF liquidado",
      lineaPrincipal: formatMoneda(cifPorKgLiquidado, "USD"),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <Card key={t.titulo}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.titulo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{t.lineaPrincipal}</p>
            {t.lineaSecundaria && <p className="text-base font-medium text-foreground">{t.lineaSecundaria}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
