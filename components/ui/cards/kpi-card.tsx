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
  valueSuffix,
  secondaryLine,
  paleta,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  /** Texto más chico, al costado del valor principal (en la misma línea) — p. ej. un valorizado en dólares junto al conteo. */
  valueSuffix?: string;
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
      {/* Padding y tipografía responsive (antes fijos en p-6/text-2xl): en
          pantallas chicas varias tarjetas KPI deben leerse a la vez (ej. 2
          por fila en el Reporte de Recepción) sin que el texto se corte o
          se superponga — a partir de `sm:` vuelve al tamaño de siempre. */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</CardTitle>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" style={colorAcento ? { color: colorAcento } : undefined} />}
      </CardHeader>
      <CardContent className="space-y-0.5 p-3 pt-0 sm:space-y-1 sm:p-6 sm:pt-0">
        <p className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums sm:text-2xl">{value}</span>
          {valueSuffix && (
            <>
              <span className="text-lg font-semibold text-muted-foreground sm:text-2xl">|</span>
              <span className="text-lg font-semibold tabular-nums text-muted-foreground sm:text-2xl">{valueSuffix}</span>
            </>
          )}
        </p>
        {secondaryLine && (
          <p
            className={cn("text-xs tabular-nums sm:text-sm", colorAcento ? "font-medium" : "text-muted-foreground")}
            style={colorAcento ? { color: colorAcento } : undefined}
          >
            {secondaryLine}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
