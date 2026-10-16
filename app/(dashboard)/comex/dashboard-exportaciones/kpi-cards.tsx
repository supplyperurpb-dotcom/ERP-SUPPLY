import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_SOBRIA } from "./colores";
import type { KpisFacturacion } from "@/lib/facturacion-exportacion";

// Azul claro de la misma paleta sobria del dashboard (PALETA_SOBRIA[1],
// "azul acero"), para resaltar el par Kg Facturados / PU CIF Facturado.
const AZUL_CLARO = PALETA_SOBRIA[1];
// Plomo claro (PALETA_SOBRIA[2], "gris azulado"), para el par Kg
// Liquidados / PU CIF Liquidado.
const PLOMO_CLARO = PALETA_SOBRIA[2];

type Tarjeta = { titulo: string; lineaPrincipal: string; lineaSecundaria?: string; acento?: string };

function TarjetaKpi({ t }: { t: Tarjeta }) {
  return (
    <Card style={t.acento ? { backgroundColor: `${t.acento}1A`, borderColor: `${t.acento}66` } : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t.titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold text-foreground">{t.lineaPrincipal}</p>
        {t.lineaSecundaria && <p className="text-base font-medium text-foreground">{t.lineaSecundaria}</p>}
      </CardContent>
    </Card>
  );
}

// Puramente presentacional: solo pinta los números que le llegan por
// props (y el $/kg, que es pura división de dos de ellos, no una cifra de
// negocio nueva). Toda la suma/filtro vive en lib/facturacion-exportacion.ts.
// Devuelve 2 columnas (Facturados / Liquidados), cada una con su tarjeta de
// kg encima y su $/kg debajo — pensado para ir en un grid de 3 columnas
// junto a PorLiquidarCard (ver dashboard-exportaciones-view.tsx).
export function KpiCards({ kpis }: { kpis: KpisFacturacion }) {
  const cifPorKgFacturado = kpis.netWeight > 0 ? kpis.invoicedAmount / kpis.netWeight : 0;
  const cifPorKgLiquidado = kpis.netKilosLiquidated > 0 ? kpis.cifLiquidatedTariffs / kpis.netKilosLiquidated : 0;

  const columnaFacturado: Tarjeta[] = [
    {
      titulo: "Kg Facturados",
      lineaPrincipal: `${formatCantidad(kpis.netWeight)} kg`,
      lineaSecundaria: formatMoneda(kpis.invoicedAmount, "USD"),
      acento: AZUL_CLARO,
    },
    {
      titulo: "PU CIF Facturado",
      lineaPrincipal: formatMoneda(cifPorKgFacturado, "USD"),
      acento: AZUL_CLARO,
    },
  ];

  const columnaLiquidado: Tarjeta[] = [
    {
      titulo: "Kg Liquidados",
      lineaPrincipal: `${formatCantidad(kpis.netKilosLiquidated)} kg`,
      lineaSecundaria: formatMoneda(kpis.cifLiquidatedTariffs, "USD"),
      acento: PLOMO_CLARO,
    },
    {
      titulo: "PU CIF Liquidado",
      lineaPrincipal: formatMoneda(cifPorKgLiquidado, "USD"),
      acento: PLOMO_CLARO,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        {columnaFacturado.map((t) => (
          <TarjetaKpi key={t.titulo} t={t} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {columnaLiquidado.map((t) => (
          <TarjetaKpi key={t.titulo} t={t} />
        ))}
      </div>
    </>
  );
}
