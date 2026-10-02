"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  aprobarSolicitudPedidoAction,
  rechazarSolicitudPedidoAction,
  anularSolicitudPedidoAction,
} from "@/lib/actions/solicitud-pedido-actions";

export function AprobarRechazarBotones({ id, numero }: { id: string; numero: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAprobar() {
    if (!confirm(`¿Aprobar la solicitud ${numero}?`)) return;
    startTransition(async () => {
      const resultado = await aprobarSolicitudPedidoAction(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Solicitud ${numero} aprobada`);
      router.refresh();
    });
  }

  function handleRechazar() {
    const comentario = prompt(`Motivo del rechazo de ${numero} (opcional):`);
    if (comentario === null) return; // canceló el prompt
    startTransition(async () => {
      const resultado = await rechazarSolicitudPedidoAction(id, comentario);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Solicitud ${numero} rechazada`);
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

// Separado de AprobarRechazarBotones porque aplica en el momento opuesto
// del ciclo de vida: rechazar mata una solicitud PENDIENTE, anular mata
// una que ya estaba APROBADA (es lo que la reemplaza a "eliminar" una vez
// aprobada).
export function AnularSolicitudBoton({ id, numero }: { id: string; numero: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAnular() {
    const comentario = prompt(`Motivo de la anulación de ${numero} (opcional):`);
    if (comentario === null) return;
    if (!confirm(`¿Anular la solicitud ${numero}? Ya no podrá jalarse hacia ninguna orden.`)) return;
    startTransition(async () => {
      const resultado = await anularSolicitudPedidoAction(id, comentario);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Solicitud ${numero} anulada`);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleAnular} className="text-destructive hover:text-destructive">
      <Ban className="mr-1 h-4 w-4" />
      Anular
    </Button>
  );
}
