import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_PENDIENTE } from "./colores";
import type { PorLiquidarResumen } from "@/lib/facturacion-exportacion";

// Kg ya facturados que todavía no se liquidan, con su valor facturado
// pendiente, y el mismo desglose por mercado — datos ya calculados por
// calcularPorLiquidar en lib/facturacion-exportacion.ts (incluye solo los
// mercados con algo pendiente). "h-full" para que ocupe el mismo alto que
// las 2 tarjetas apiladas de al lado (Kg Liquidados + $/Kg CIF Liquidado).
export function PorLiquidarCard({ datos }: { datos: PorLiquidarResumen }) {
  return (
    <Card className="flex h-full flex-col border-l-4" style={{ borderLeftColor: PALETA_PENDIENTE.titulo }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Kg Facturados por Liquidar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tabular-nums">{formatCantidad(datos.kg)} Kg</p>
          <p className="text-base font-medium tabular-nums" style={{ color: PALETA_PENDIENTE.titulo }}>
            – {formatMoneda(datos.valor, "USD")}
            {datos.puCif !== null && <span className="ml-2 text-sm text-muted-foreground">(PU CIF {formatMoneda(datos.puCif, "USD")})</span>}
          </p>
        </div>
        {datos.porMercado.length > 0 && (
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 gap-y-1 border-t pt-2 text-sm">
            {datos.porMercado.map((m) => (
              <Fragment key={m.mercado}>
                <span className="font-medium" style={{ color: PALETA_PENDIENTE.titulo }}>
                  {m.mercado}
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{formatCantidad(m.kg)} Kg</span>
                <span className="text-right tabular-nums text-muted-foreground">{formatMoneda(m.valor, "USD")}</span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {m.puCif !== null ? `PU CIF ${formatMoneda(m.puCif, "USD")}` : "—"}
                </span>
              </Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
