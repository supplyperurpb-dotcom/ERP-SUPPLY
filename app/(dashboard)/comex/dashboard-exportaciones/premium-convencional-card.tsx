import { Star, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { PALETA_FACTURADO, PALETA_LIQUIDADO, COLOR_CONVENCIONAL_TARJETA, type PaletaTarjeta } from "./colores";
import type { Participacion } from "@/lib/facturacion-exportacion";

const ICONO_TIPO: Record<string, typeof Star> = { PREMIUM: Star, CONVENCIONAL: Package };

// Participación de PREMIUM y CONVENCIONAL sobre el total de kg de la
// métrica que le pase el padre (facturado o liquidado; mismo campo "type"
// de la hoja Facturación) — datos ya calculados por calcularParticipacion
// o calcularParticipacionLiquidado en lib/facturacion-exportacion.ts.
export function PremiumConvencionalCard({
  titulo,
  datos,
  variante,
}: {
  titulo: string;
  datos: Participacion[];
  /** Qué identidad de color usa la tarjeta (y "Premium" dentro de ella) — Facturado=azul, Liquidado=verde. */
  variante: "facturado" | "liquidado";
}) {
  const premium = datos.find((d) => d.etiqueta === "PREMIUM");
  const convencional = datos.find((d) => d.etiqueta === "CONVENCIONAL");
  const paleta: PaletaTarjeta = variante === "facturado" ? PALETA_FACTURADO : PALETA_LIQUIDADO;

  return (
    <Card style={{ backgroundColor: paleta.fondo, borderColor: paleta.borde }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium" style={{ color: paleta.titulo }}>
          {titulo}
        </CardTitle>
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
              // Premium usa la identidad de la tarjeta (etiqueta en el tono
              // de título, % en el tono de valor principal, más oscuro);
              // Convencional mantiene un único dorado para todo.
              const colorEtiqueta = etiqueta === "PREMIUM" ? paleta.titulo : COLOR_CONVENCIONAL_TARJETA;
              const colorValor = etiqueta === "PREMIUM" ? paleta.valor : COLOR_CONVENCIONAL_TARJETA;
              const colorSecundario = etiqueta === "PREMIUM" ? paleta.valorSecundario : COLOR_CONVENCIONAL_TARJETA;
              return (
                <div key={etiqueta}>
                  <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: colorEtiqueta }}>
                    <Icono className="h-3.5 w-3.5 shrink-0" />
                    {etiquetaMostrar}
                  </p>
                  <p className="text-2xl font-semibold" style={{ color: colorValor }}>
                    {dato ? `${dato.participacionPct.toFixed(1)}%` : "—"}
                  </p>
                  {dato && (
                    <>
                      <p className="text-sm font-medium" style={{ color: colorSecundario }}>
                        {formatCantidad(dato.netWeight)} Kg
                      </p>
                      {typeof dato.puCif === "number" && (
                        <p className="text-sm font-medium" style={{ color: colorSecundario }}>
                          PU CIF: {formatMoneda(dato.puCif, "USD")}
                        </p>
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
