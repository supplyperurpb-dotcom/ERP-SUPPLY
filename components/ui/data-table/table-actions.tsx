import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Contenedor para los botones de acción de una fila (editar/eliminar/etc.),
 * alineados a la derecha — formaliza la celda final repetida en cada tabla.
 */
export function TableActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-1", className)}>{children}</div>;
}
