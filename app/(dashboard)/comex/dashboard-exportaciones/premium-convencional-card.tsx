import { Star, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara } from "./colores";
import type { Participacion } from "@/lib/facturacion-exportacion";

const ICONO_TIPO: Record<string, typeof Star> = { PREMIUM: Star, CONVENCIONAL: Package };

// Participación de PREMIUM y CONVENCIONAL sobre el total de kg de la
// métrica que le pase el padre (facturado o liquidado; mismo campo "type"
// de la hoja Facturación) — datos ya calculados por calcularParticipacion
// o calcularParticipacionLiquidado en lib/facturacion-exportacion.ts.
export function PremiumConvencionalCard({
  titulo,
  datos,
  colorFondo,
}: {
  titulo: string;
  datos: Participacion[];
  /** Color de fondo opcional para la tarjeta (ej. para distinguir "Kg Facturados" de "Kg Liquidados"). */
  colorFondo?: string;
}) {
  const premium = datos.find((d) => d.etiqueta === "PREMIUM");
  const convencional = datos.find((d) => d.etiqueta === "CONVENCIONAL");

  return (
    <Card style={colorFondo ? { backgroundColor: `${colorFondo}1A`, borderColor: `${colorFondo}66` } : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { etiqueta: "PREMIUM", etiquetaMostrar: "Premium", dato: premium },
              { etiqueta: "CONVENCIONAL", etiquetaMostrar: "Convencional", dato: convencional },
            ].map(({ etiqueta, etiquetaMostrar, dato }) => {
              const Icono = ICONO_TIPO[etiqueta];
              return (
                <div key={etiqueta}>
                  <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: colorPara(etiqueta, 0) }}>
                    <Icono className="h-3.5 w-3.5 shrink-0" />
                    {etiquetaMostrar}
                  </p>
                  <p className="text-2xl font-semibold" style={{ color: colorPara(etiqueta, 0) }}>
                    {dato ? `${dato.participacionPct.toFixed(1)}%` : "—"}
                  </p>
                  {dato && (
                    <>
                      <p className="text-sm text-muted-foreground">{formatCantidad(dato.netWeight)} Kg</p>
                      {typeof dato.puCif === "number" && (
                        <p className="text-sm text-muted-foreground">PU CIF: {formatMoneda(dato.puCif, "USD")}</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
