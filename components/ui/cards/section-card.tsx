import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Envoltorio del patrón más repetido en la app: una Card con título
 * (+ descripción/acciones opcionales) agrupando una sección del
 * formulario/página. Mismo Card de siempre, solo evita retipear
 * CardHeader/CardTitle/CardContent en cada archivo.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Fase 3 (propuesta visual aprobada para el dashboard de Exportaciones):
  // sin la sombra por defecto de Card y con el título un poco más chico —
  // "menos card sobre card", el contenido (gráfico/tabla) es lo que debe
  // destacar, no el marco que lo envuelve.
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className={actions ? "flex flex-row items-center justify-between space-y-0" : undefined}>
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
