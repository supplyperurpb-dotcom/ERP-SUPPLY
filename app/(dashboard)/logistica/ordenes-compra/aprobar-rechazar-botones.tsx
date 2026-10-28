"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban, Undo2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/shared/confirm-dialog-provider";
import {
  firmarOrdenCompraAction,
  anularOrdenCompraAction,
  anularFirmaOrdenCompraAction,
  cerrarPosicionOrdenCompraItemAction,
  reabrirPosicionOrdenCompraItemAction,
} from "@/lib/actions/orden-compra-actions";

// Firma el rol de aprobación pendiente del usuario actual en esta OC/OS
// (ver firmarOrdenCompraAction: cada orden puede necesitar varias firmas
// según su monto, y esta orden solo queda APROBADA cuando todas lo están).
export function FirmarOrdenBotones({ id, numero, rolLabel }: { id: string; numero: string; rolLabel: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();
  const pedir = usePrompt();

  async function handleAprobar() {
    if (!(await confirmar(`¿Aprobar ${numero} como ${rolLabel}?`))) return;
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

  async function handleRechazar() {
    const comentario = await pedir(`Motivo del rechazo de ${numero} (opcional):`);
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

// Deshace la propia firma ya aprobada (o cualquiera, si es ADMIN) — pedido
// explícito: "desliberación" firma por firma, para poder volver a editar
// la orden. Solo aparece en el detalle junto a una firma en APROBADO que
// le pertenece a quien la ve (ver anularFirmaOrdenCompraAction).
export function AnularFirmaBoton({ id, firmaId, numero, rolLabel }: { id: string; firmaId: string; numero: string; rolLabel: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();
  const pedir = usePrompt();

  async function handleAnularFirma() {
    const comentario = await pedir(`Motivo para anular tu aprobación (${rolLabel}) de ${numero} (opcional):`);
    if (comentario === null) return;
    if (!(await confirmar(`¿Anular tu aprobación (${rolLabel}) de ${numero}?`))) return;
    startTransition(async () => {
      const resultado = await anularFirmaOrdenCompraAction(id, firmaId, comentario);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Aprobación anulada en ${numero}`);
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={handleAnularFirma} className="text-destructive hover:text-destructive">
      <Undo2 className="mr-1 h-4 w-4" />
      Anular Aprobación
    </Button>
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
  const confirmar = useConfirm();
  const pedir = usePrompt();

  async function handleAnular() {
    const comentario = await pedir(`Motivo de la anulación de ${numero} (opcional):`);
    if (comentario === null) return;
    if (!(await confirmar(`¿Anular ${numero}?`))) return;
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

// Cierra una línea puntual de la orden que ya no va a recibirse (no
// llegará, o ya no se quiere) — deja de contar como pendiente en el
// buscador de "Nuevo ingreso" a almacén, sin tocar el resto de la orden
// (ver cerrarPosicionOrdenCompraItemAction).
export function CerrarPosicionBoton({ itemId, codigo }: { itemId: string; codigo: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();
  const pedir = usePrompt();

  async function handleCerrar() {
    const motivo = await pedir(`Motivo del cierre de ${codigo} (opcional):`);
    if (motivo === null) return;
    if (!(await confirmar(`¿Cerrar la posición de ${codigo}? Dejará de aparecer como pendiente de recibir.`))) return;
    startTransition(async () => {
      const resultado = await cerrarPosicionOrdenCompraItemAction(itemId, motivo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Posición de ${codigo} cerrada`);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={handleCerrar}
      className="text-destructive hover:text-destructive"
    >
      <Lock className="mr-1 h-4 w-4" />
      Cerrar posición
    </Button>
  );
}

// Reversa de CerrarPosicionBoton.
export function ReabrirPosicionBoton({ itemId, codigo }: { itemId: string; codigo: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleReabrir() {
    if (!(await confirmar(`¿Reabrir la posición de ${codigo}? Volverá a contar como pendiente de recibir.`))) return;
    startTransition(async () => {
      const resultado = await reabrirPosicionOrdenCompraItemAction(itemId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`Posición de ${codigo} reabierta`);
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={handleReabrir}>
      <LockOpen className="mr-1 h-4 w-4" />
      Reabrir
    </Button>
  );
}
