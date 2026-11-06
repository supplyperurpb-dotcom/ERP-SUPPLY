import type { ReactNode } from "react";
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
  return (
    <Card className={className}>
      <CardHeader className={actions ? "flex flex-row items-center justify-between space-y-0" : undefined}>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
