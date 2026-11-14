import { PackageCheck, Truck, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { PALETA_ARRIBADOS, PALETA_EN_TRANSITO, type PaletaTarjeta } from "./colores";
import type { ResumenEstadoContenedores } from "@/lib/facturacion-exportacion";

// Ícono por estado, para "iconografía consistente" (Fase 3) — completado
// vs. en curso. Si apareciera un estado nuevo sin mapear, no se muestra
// ícono (nunca se inventa uno).
const ICONO_ESTADO: Record<string, typeof PackageCheck> = {
  ARRIBADO: PackageCheck,
  "EN TRANSITO": Truck,
};

// Nombre amigable para cada estado real de la columna STATUS EMBARQUE del
// Excel — si apareciera un estado nuevo que no está en este mapa, se usa
// el valor tal cual viene (nunca se inventa una etiqueta).
const ETIQUETA_ESTADO: Record<string, string> = {
  ARRIBADO: "Embarques Arribados",
  "EN TRANSITO": "Embarques En Tránsito",
};

// Identidad propia por estado (turquesa/lavanda), independiente de
// Facturado/Liquidado — si apareciera un estado nuevo sin mapear, la
// tarjeta queda sin tinte en vez de inventarle un color.
const PALETA_ESTADO: Record<string, PaletaTarjeta> = {
  ARRIBADO: PALETA_ARRIBADOS,
  "EN TRANSITO": PALETA_EN_TRANSITO,
};

// Resumen visual rápido: cuántos embarques (PO) hay arribados vs. en
// tránsito, con su kg y valor facturado — datos ya calculados por
// calcularResumenPorEstado en lib/facturacion-exportacion.ts.
export function EstadoResumenCards({ resumen }: { resumen: ResumenEstadoContenedores[] }) {
  if (resumen.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {resumen.map((r) => {
        const paleta = PALETA_ESTADO[r.estado];
        const Icono = ICONO_ESTADO[r.estado];
        return (
          <Card key={r.estado} className={paleta ? "border-l-4" : undefined} style={paleta ? { borderLeftColor: paleta.titulo } : undefined}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Ship className="h-4 w-4 shrink-0" />
                {ETIQUETA_ESTADO[r.estado] ?? r.estado}
              </CardTitle>
              {Icono && <Icono className="h-4 w-4 shrink-0" style={paleta ? { color: paleta.titulo } : undefined} />}
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold tabular-nums">{r.n} Embarques</p>
              <p className="text-base font-medium tabular-nums" style={paleta ? { color: paleta.titulo } : undefined}>
                {formatCantidad(r.netWeight)} Kg
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">{formatMoneda(r.invoicedAmount, "USD")}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
