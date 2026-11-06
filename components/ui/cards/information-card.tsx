import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InformationItem = { label: string; value: string };

/**
 * Grid de pares label/valor de solo lectura — formaliza el patrón
 * "Datos del camión"/"Datos del despacho" repetido en varias páginas de
 * detalle (Ingreso, Despacho, Packing List, etc.).
 */
export function InformationCard({
  title,
  items,
  columns = 4,
  className,
}: {
  title?: string;
  items: InformationItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colsClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[
    columns
  ];

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn("grid grid-cols-1 gap-4 text-sm", colsClass)}>
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="font-medium">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
