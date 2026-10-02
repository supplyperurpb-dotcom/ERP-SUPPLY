"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  aprobarOrdenCompraAction,
  rechazarOrdenCompraAction,
  anularOrdenCompraAction,
} from "@/lib/actions/orden-compra-actions";

export function AprobarRechazarOrdenBotones({ id, numero }: { id: string; numero: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAprobar() {
    if (!confirm(`¿Aprobar ${numero}?`)) return;
    startTransition(async () => {
      const resultado = await aprobarOrdenCompraAction(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${numero} aprobada`);
      router.refresh();
    });
  }

  function handleRechazar() {
    const comentario = prompt(`Motivo del rechazo de ${numero} (opcional):`);
    if (comentario === null) return;
    startTransition(async () => {
      const resultado = await rechazarOrdenCompraAction(id, comentario);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${numero} rechazada`);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={handleAprobar} className="text-green-700 hover:text-green-800">
        <Check className="mr-1 h-4 w-4" />
        Aprobar
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={handleRechazar} className="text-destructive hover:text-destructive">
        <X className="mr-1 h-4 w-4" />
        Rechazar
      </Button>
    </div>
  );
}

// Separado de AprobarRechazarOrdenBotones porque aplica en cualquier
// momento del ciclo de vida: antes de aprobada, anular equivale a borrar y
// lo puede usar cualquiera; ya aprobada (solo ADMIN o el aprobador de
// alguna de las áreas de la orden) no se borra, queda registrada como
// ANULADO y sus cantidades jaladas vuelven a quedar pendientes en sus
// solicitudes de origen — la acción en el servidor vuelve a verificar el
// permiso.
export function AnularOrdenBoton({
  id,
  numero,
  redirectTo,
}: {
  id: string;
  numero: string;
  /** Solo se usa en la página de detalle: si la orden aún no estaba aprobada, anular la borra, así que no queda nada que refrescar. */
  redirectTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAnular() {
    const comentario = prompt(`Motivo de la anulación de ${numero} (opcional):`);
    if (comentario === null) return;
    if (!confirm(`¿Anular ${numero}?`)) return;
    startTransition(async () => {
      const resultado = await anularOrdenCompraAction(id, comentario);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${numero} anulada`);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleAnular} className="text-destructive hover:text-destructive">
      <Ban className="mr-1 h-4 w-4" />
      Anular
    </Button>
  );
}
