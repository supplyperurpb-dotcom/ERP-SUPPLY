import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad } from "@/lib/utils";
import { colorPara } from "./colores";
import type { Participacion } from "@/lib/facturacion-exportacion";

// Participación de PREMIUM y CONVENCIONAL sobre el total de kg de la
// métrica que le pase el padre (facturado o liquidado; mismo campo "type"
// de la hoja Facturación) — datos ya calculados por calcularParticipacion
// o calcularParticipacionLiquidado en lib/facturacion-exportacion.ts.
export function PremiumConvencionalCard({ titulo, datos }: { titulo: string; datos: Participacion[] }) {
  const premium = datos.find((d) => d.etiqueta === "PREMIUM");
  const convencional = datos.find((d) => d.etiqueta === "CONVENCIONAL");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { etiqueta: "PREMIUM", dato: premium },
              { etiqueta: "CONVENCIONAL", dato: convencional },
            ].map(({ etiqueta, dato }) => (
              <div key={etiqueta}>
                <p className="text-sm font-medium" style={{ color: colorPara(etiqueta, 0) }}>
                  {etiqueta}
                </p>
                <p className="text-2xl font-semibold" style={{ color: colorPara(etiqueta, 0) }}>
                  {dato ? `${dato.participacionPct.toFixed(1)}%` : "—"}
                </p>
                {dato && <p className="text-sm text-muted-foreground">{formatCantidad(dato.netWeight)} kg</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
