import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Color de identidad de una tarjeta KPI (ver PaletaTarjeta en colores.ts de cada dashboard que la use) — KPICard solo lee `titulo`, para la barra de acento y el ícono. */
export type PaletaTarjetaKPI = {
  titulo: string;
};

/**
 * Tarjeta de indicador con una barra de acento lateral opcional (color de
 * una paleta corporativa) — el valor principal se lee siempre en el color
 * normal del tema, nunca en el color de marca (ver DESIGN_SYSTEM.md).
 */
export function KPICard({
  label,
  value,
  secondaryLine,
  paleta,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  secondaryLine?: string;
  /** Si no se pasa, usa el estilo default de Card (sin tinte, sin colorear texto). */
  paleta?: PaletaTarjetaKPI;
  /** Ícono opcional junto al label, teñido con `paleta.titulo` si se pasa paleta. */
  icon?: LucideIcon;
  className?: string;
}) {
  // Barra de acento a la izquierda en vez de fondo+borde teñidos — jerarquía
  // por estructura, no por repetir la misma card con tinte en todos lados
  // (Fase 3, extendido a los dashboards con `paleta` propia tras aprobar la
  // propuesta visual del dashboard de Exportaciones). El color de la
  // paleta queda en la barra, el ícono y la línea secundaria; el valor
  // principal se lee en el texto normal del tema, no en el color de marca.
  const colorAcento = paleta?.titulo;
  return (
    <Card
      className={cn("border-l-4", !colorAcento && "border-l-primary", className)}
      style={colorAcento ? { borderLeftColor: colorAcento } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 shrink-0" style={colorAcento ? { color: colorAcento } : undefined} />}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {secondaryLine && (
          <p
            className={cn("text-sm tabular-nums", colorAcento ? "font-medium" : "text-muted-foreground")}
            style={colorAcento ? { color: colorAcento } : undefined}
          >
            {secondaryLine}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
