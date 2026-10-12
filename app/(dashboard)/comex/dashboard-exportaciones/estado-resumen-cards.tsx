import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { colorPara } from "./colores";
import type { ResumenEstadoContenedores } from "@/lib/facturacion-exportacion";

// Nombre amigable para cada estado real de la columna STATUS EMBARQUE del
// Excel — si apareciera un estado nuevo que no está en este mapa, se usa
// el valor tal cual viene (nunca se inventa una etiqueta).
const ETIQUETA_ESTADO: Record<string, string> = {
  ARRIBADO: "Contenedores arribados",
  "EN TRANSITO": "Contenedores en agua",
};

// Resumen visual rápido: cuántos embarques (PO) hay arribados vs. en
// tránsito, con su kg y valor facturado — datos ya calculados por
// calcularResumenPorEstado en lib/facturacion-exportacion.ts.
export function EstadoResumenCards({ resumen }: { resumen: ResumenEstadoContenedores[] }) {
  if (resumen.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {resumen.map((r, i) => {
        const color = colorPara(r.estado, i);
        return (
          <Card key={r.estado} style={{ backgroundColor: `${color}1A`, borderColor: `${color}66` }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {ETIQUETA_ESTADO[r.estado] ?? r.estado}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold" style={{ color }}>
                {r.n} {r.n === 1 ? "contenedor" : "contenedores"}
              </p>
              <p className="text-base font-medium text-foreground">{formatCantidad(r.netWeight)} kg</p>
              <p className="text-sm text-muted-foreground">{formatMoneda(r.invoicedAmount, "USD")}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
