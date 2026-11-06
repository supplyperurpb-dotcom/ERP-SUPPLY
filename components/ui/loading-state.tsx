import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spinner con mensaje opcional, para el hueco de una sección mientras
 * carga (ej. contenido de un tab, un panel con fetch propio). Para un
 * botón en estado "enviando", se sigue usando el patrón existente de
 * `SubmitButton`/`disabled`+texto cambiado, no este componente.
 */
export function LoadingState({ mensaje, className }: { mensaje?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
      {mensaje && <p>{mensaje}</p>}
    </div>
  );
}
