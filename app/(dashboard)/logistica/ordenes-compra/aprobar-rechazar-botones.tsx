"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { firmarOrdenCompraAction, anularOrdenCompraAction } from "@/lib/actions/orden-compra-actions";

// Firma el rol de aprobación pendiente del usuario actual en esta OC/OS
// (ver firmarOrdenCompraAction: cada orden puede necesitar varias firmas
// según su monto, y esta orden solo queda APROBADA cuando todas lo están).
export function FirmarOrdenBotones({ id, numero, rolLabel }: { id: string; numero: string; rolLabel: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAprobar() {
    if (!confirm(`¿Aprobar ${numero} como ${rolLabel}?`)) return;
    startTransition(async () => {
      const resultado = await firmarOrdenCompraAction(id, "APROBADO");
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Firma registrada en ${numero}`);
      router.refresh();
    });
  }

  function handleRechazar() {
    const comentario = prompt(`Motivo del rechazo de ${numero} (opcional):`);
    if (comentario === null) return;
    startTransition(async () => {
      const resultado = await firmarOrdenCompraAction(id, "RECHAZADO", comentario);
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

// Exclusivo de quien tenga el rol ANULADOR (la acción en el servidor
// vuelve a verificar el permiso). Nunca borra el registro: en cualquier
// estado solo lo bloquea, pasando a ANULADO, y sus cantidades jaladas
// vuelven a quedar pendientes en sus solicitudes de origen.
export function AnularOrdenBoton({
  id,
  numero,
  redirectTo,
}: {
  id: string;
  numero: string;
  /** Solo se usa en la página de detalle, para volver al listado tras anular. */
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
