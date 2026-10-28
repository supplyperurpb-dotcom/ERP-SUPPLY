"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/shared/confirm-dialog-provider";
import {
  decidirItemSolicitudAction,
  finalizarAprobacionSolicitudAction,
  anularSolicitudPedidoAction,
} from "@/lib/actions/solicitud-pedido-actions";

// Check/X por línea — la decisión queda guardada al toque, no hace falta
// "Finalizar aprobación" para que se registre (eso solo cierra el
// documento completo una vez que ninguna línea quede PENDIENTE).
export function ItemDecisionBotones({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function decidir(decision: "APROBADO" | "RECHAZADO") {
    startTransition(async () => {
      const resultado = await decidirItemSolicitudAction(itemId, decision);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => decidir("APROBADO")}
        title="Aprobar este producto"
        className="text-green-700 hover:text-green-800"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => decidir("RECHAZADO")}
        title="Rechazar este producto"
        className="text-destructive hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Cierra la revisión: exige que todas las líneas ya tengan decisión (ver
// finalizarAprobacionSolicitudAction, que valida esto también en el
// servidor). Deja el documento APROBADO o RECHAZADO según el resultado.
export function FinalizarAprobacionBoton({
  id,
  numero,
  todosDecididos,
}: {
  id: string;
  numero: string;
  todosDecididos: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleFinalizar() {
    if (!(await confirmar(`¿Finalizar la aprobación de ${numero}? Ya no vas a poder cambiar las decisiones de cada producto.`))) return;
    startTransition(async () => {
      const resultado = await finalizarAprobacionSolicitudAction(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Aprobación de ${numero} finalizada`);
      router.refresh();
    });
  }

  return (
    <Button
      disabled={pending || !todosDecididos}
      onClick={handleFinalizar}
      title={todosDecididos ? undefined : "Aprueba o rechaza todos los productos antes de finalizar"}
    >
      <ClipboardCheck className="mr-2 h-4 w-4" />
      Finalizar aprobación
    </Button>
  );
}

// Separado de lo anterior porque aplica en cualquier momento del ciclo de
// vida: antes de estar aprobada, anular equivale a borrar y lo puede usar
// cualquiera; ya aprobada, solo el aprobador del área (en ese caso no se
// borra, queda registrada como ANULADO).
export function AnularSolicitudBoton({
  id,
  numero,
  redirectTo,
}: {
  id: string;
  numero: string;
  /** Solo se usa en la página de detalle: si la solicitud aún no estaba aprobada, anular la borra, así que no queda nada que refrescar. */
  redirectTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();
  const pedir = usePrompt();

  async function handleAnular() {
    const comentario = await pedir(`Motivo de la anulación de ${numero} (opcional):`);
    if (comentario === null) return;
    if (!(await confirmar(`¿Anular la solicitud ${numero}?`))) return;
    startTransition(async () => {
      const resultado = await anularSolicitudPedidoAction(id, comentario);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Solicitud ${numero} anulada`);
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
