import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 5 roles de color de una identidad visual de tarjeta (ver PaletaTarjeta en colores.ts de cada dashboard que la use). */
export type PaletaTarjetaKPI = {
  fondo: string;
  borde: string;
  titulo: string;
  valor: string;
  valorSecundario: string;
};

/**
 * Tarjeta de indicador con una identidad de color completa: fondo, borde,
 * color de título/ícono, valor principal y valor secundario — todos
 * colores exactos (no derivados por alpha), para que coincidan pixel a
 * pixel con una paleta corporativa dada.
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
  return (
    <Card
      className={className}
      style={paleta ? { backgroundColor: paleta.fondo, borderColor: paleta.borde } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={paleta ? "text-sm font-medium" : "text-sm font-medium text-muted-foreground"}
          style={paleta ? { color: paleta.titulo } : undefined}
        >
          {label}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 shrink-0" style={paleta ? { color: paleta.titulo } : undefined} />}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold" style={paleta ? { color: paleta.valor } : undefined}>
          {value}
        </p>
        {secondaryLine && (
          <p
            className={paleta ? "text-sm font-medium" : "text-sm text-muted-foreground"}
            style={paleta ? { color: paleta.valorSecundario } : undefined}
          >
            {secondaryLine}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
