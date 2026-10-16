import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import type { PorLiquidarResumen } from "@/lib/facturacion-exportacion";

// Kg ya facturados que todavía no se liquidan, con su valor facturado
// pendiente, y el mismo desglose por mercado — datos ya calculados por
// calcularPorLiquidar en lib/facturacion-exportacion.ts (incluye solo los
// mercados con algo pendiente). "h-full" para que ocupe el mismo alto que
// las 2 tarjetas apiladas de al lado (Kg Liquidados + $/Kg CIF Liquidado).
export function PorLiquidarCard({ datos }: { datos: PorLiquidarResumen }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Kg Facturados por Liquidar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="space-y-1">
          <p className="text-2xl font-semibold">{formatCantidad(datos.kg)} kg</p>
          <p className="text-base font-medium text-foreground">– {formatMoneda(datos.valor, "USD")}</p>
        </div>
        {datos.porMercado.length > 0 && (
          <div className="space-y-1.5 border-t pt-2">
            {datos.porMercado.map((m) => (
              <div key={m.mercado} className="flex items-baseline gap-2 text-sm">
                <span className="font-medium text-muted-foreground">{m.mercado}:</span>
                <span className="text-foreground">
                  {formatCantidad(m.kg)} kg – {formatMoneda(m.valor, "USD")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
