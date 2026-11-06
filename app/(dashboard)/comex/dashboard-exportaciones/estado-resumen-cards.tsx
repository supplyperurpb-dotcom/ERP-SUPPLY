import { PackageCheck, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneda, formatCantidad } from "@/lib/utils";
import { colorPara } from "./colores";
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

// Fondo puntual pedido para "Arribados" (mismo tono que las tarjetas de
// facturación) — el resto de estados sigue con colorPara más abajo.
const COLOR_FONDO_OVERRIDE: Record<string, string> = {
  ARRIBADO: "#8dcfec",
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
        const colorFondo = COLOR_FONDO_OVERRIDE[r.estado] ?? color;
        const Icono = ICONO_ESTADO[r.estado];
        return (
          <Card key={r.estado} style={{ backgroundColor: `${colorFondo}1A`, borderColor: `${colorFondo}66` }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {ETIQUETA_ESTADO[r.estado] ?? r.estado}
              </CardTitle>
              {Icono && <Icono className="h-4 w-4 shrink-0" style={{ color }} />}
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold" style={{ color }}>
                {r.n} Embarques
              </p>
              <p className="text-base font-medium text-foreground">{formatCantidad(r.netWeight)} Kg</p>
              <p className="text-sm text-muted-foreground">{formatMoneda(r.invoicedAmount, "USD")}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
