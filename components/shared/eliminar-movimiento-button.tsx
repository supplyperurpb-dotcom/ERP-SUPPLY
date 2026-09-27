"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Botón de eliminar con aviso de confirmación (confirm() nativo, igual que
 * en SKU y Proveedor) para los movimientos de almacén (ingreso, traslado,
 * consumo). `redirectTo` se usa en la página de detalle (para volver al
 * listado); se omite en las filas de una tabla, donde basta refrescar.
 */
export function EliminarMovimientoButton({
  id,
  numero,
  etiqueta,
  accion,
  redirectTo,
}: {
  id: string;
  numero: string;
  etiqueta: string;
  accion: (id: string) => Promise<{ error?: string } | undefined>;
  redirectTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm(`¿Eliminar ${etiqueta} ${numero}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const resultado = await accion(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${etiqueta} eliminado`);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={handleClick}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
