"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { actualizarDescripcionItemOrdenAction } from "@/lib/actions/orden-compra-actions";

/** Edición in-line del detalle de un ítem de Orden de Servicio, para afinar el alcance después de creada. */
export function EditarDescripcionServicio({
  itemId,
  descripcion,
  editable = true,
}: {
  itemId: string;
  descripcion: string | null;
  editable?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(descripcion ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!editando) {
    return (
      <div className="flex items-start justify-between gap-2">
        <span className="whitespace-pre-wrap">{descripcion || "—"}</span>
        {editable && (
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditando(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  function guardar() {
    startTransition(async () => {
      const resultado = await actualizarDescripcionItemOrdenAction(itemId, valor);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Descripción actualizada");
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea rows={2} value={valor} onChange={(e) => setValor(e.target.value)} disabled={pending} autoFocus />
      <div className="flex gap-1">
        <Button size="icon" className="h-6 w-6" disabled={pending} onClick={guardar}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          disabled={pending}
          onClick={() => {
            setValor(descripcion ?? "");
            setEditando(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
