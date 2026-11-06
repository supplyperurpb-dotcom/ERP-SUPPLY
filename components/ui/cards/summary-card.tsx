import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Tarjeta simple de un solo dato (sin tinte de color, a diferencia de
 * KPICard) — para totales/resúmenes puntuales, ej. "Total despachado",
 * "N.º de tarjas".
 */
export function SummaryCard({
  label,
  value,
  icono: Icono,
  className,
}: {
  label: string;
  value: string;
  icono?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 pt-6">
        {Icono && <Icono className="h-8 w-8 shrink-0 text-muted-foreground" />}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
