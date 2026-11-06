import { Package, DollarSign } from "lucide-react";
import { KPICard } from "@/components/ui/cards/kpi-card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_SOBRIA } from "./colores";
import type { KpisFacturacion } from "@/lib/facturacion-exportacion";

// Azul claro pedido para resaltar el par Kg Facturados / PU CIF Facturado
// (distinto de la paleta sobria genérica — color puntual para estas tarjetas).
const AZUL_CLARO = "#8dcfec";
// Plomo claro (PALETA_SOBRIA[2], "gris azulado"), para el par Kg
// Liquidados / PU CIF Liquidado.
const PLOMO_CLARO = PALETA_SOBRIA[2];

// Puramente presentacional: solo pinta los números que le llegan por
// props (y el $/kg, que es pura división de dos de ellos, no una cifra de
// negocio nueva). Toda la suma/filtro vive en lib/facturacion-exportacion.ts.
// Devuelve 2 columnas (Facturados / Liquidados), cada una con su tarjeta de
// kg encima y su $/kg debajo — pensado para ir en un grid de 3 columnas
// junto a PorLiquidarCard (ver dashboard-exportaciones-view.tsx).
export function KpiCards({ kpis }: { kpis: KpisFacturacion }) {
  const cifPorKgFacturado = kpis.netWeight > 0 ? kpis.invoicedAmount / kpis.netWeight : 0;
  const cifPorKgLiquidado = kpis.netKilosLiquidated > 0 ? kpis.cifLiquidatedTariffs / kpis.netKilosLiquidated : 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <KPICard
          label="Kg Facturados"
          value={`${formatCantidad(kpis.netWeight)} Kg`}
          secondaryLine={formatMoneda(kpis.invoicedAmount, "USD")}
          color={AZUL_CLARO}
          icon={Package}
        />
        <KPICard
          label="PU CIF Facturado"
          value={formatMoneda(cifPorKgFacturado, "USD")}
          color={AZUL_CLARO}
          icon={DollarSign}
        />
      </div>
      <div className="flex flex-col gap-4">
        <KPICard
          label="Kg Liquidados"
          value={`${formatCantidad(kpis.netKilosLiquidated)} Kg`}
          secondaryLine={formatMoneda(kpis.cifLiquidatedTariffs, "USD")}
          color={PLOMO_CLARO}
          icon={Package}
        />
        <KPICard
          label="PU CIF Liquidado"
          value={formatMoneda(cifPorKgLiquidado, "USD")}
          color={PLOMO_CLARO}
          icon={DollarSign}
        />
      </div>
    </>
  );
}
