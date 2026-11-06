import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Tarjeta de indicador con acento de color (formaliza el patrón
 * `${color}1A`/`${color}66` ya usado a mano en el dashboard de
 * Exportaciones: 10% alpha de fondo, 40% alpha de borde).
 */
export function KPICard({
  label,
  value,
  secondaryLine,
  color,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  secondaryLine?: string;
  /** Hex, ej. "#1F3A5F" — si no se pasa, usa el estilo default de Card (sin tinte). */
  color?: string;
  /** Ícono opcional junto al label, teñido con `color` si se pasa. */
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card
      className={className}
      style={color ? { backgroundColor: `${color}1A`, borderColor: `${color}66` } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 shrink-0" style={color ? { color } : undefined} />}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold" style={color ? { color } : undefined}>
          {value}
        </p>
        {secondaryLine && <p className="text-sm text-muted-foreground">{secondaryLine}</p>}
      </CardContent>
    </Card>
  );
}
