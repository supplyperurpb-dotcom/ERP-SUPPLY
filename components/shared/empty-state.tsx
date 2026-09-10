import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icono: Icono,
  titulo,
  descripcion,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <Icono className="h-10 w-10 text-muted-foreground" />
      <p className="font-medium">{titulo}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{descripcion}</p>
    </div>
  );
}
