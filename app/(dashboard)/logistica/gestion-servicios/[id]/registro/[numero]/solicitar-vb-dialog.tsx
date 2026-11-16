"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { solicitarVbRegistroAvanceAction } from "@/lib/actions/servicio-gestionado-actions";

export type UsuarioOpcion = { id: string; nombreCompleto: string };

// Elegir a quién pedirle el VB de este registro CULMINADO (ver
// solicitarVbRegistroAvanceAction) — la lista es todos los usuarios
// creados en el sistema, pedido explícito.
export function SolicitarVbDialog({ registroAvanceId, usuarios }: { registroAvanceId: string; usuarios: UsuarioOpcion[] }) {
  const [open, setOpen] = useState(false);
  const [aprobadorId, setAprobadorId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(valor: boolean) {
    setOpen(valor);
    if (!valor) setAprobadorId("");
  }

  function handleEnviar() {
    if (!aprobadorId) return;
    startTransition(async () => {
      const resultado = await solicitarVbRegistroAvanceAction(registroAvanceId, aprobadorId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("VB solicitado");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Solicitar VB</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar VB</DialogTitle>
        </DialogHeader>

        <Combobox
          items={usuarios}
          value={aprobadorId}
          onSelect={(u) => setAprobadorId(u.id)}
          itemKey={(u) => u.id}
          matchValue={(u) => u.id}
          searchValue={(u) => u.nombreCompleto}
          renderItem={(u) => <span>{u.nombreCompleto}</span>}
          placeholder="Selecciona un usuario..."
          searchPlaceholder="Buscar usuario..."
          emptyMessage="No se encontró ningún usuario."
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!aprobadorId || pending} onClick={handleEnviar}>
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
