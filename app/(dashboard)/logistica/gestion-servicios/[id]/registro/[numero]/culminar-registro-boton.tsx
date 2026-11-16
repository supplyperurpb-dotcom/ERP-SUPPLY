"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import { culminarRegistroAvanceAction } from "@/lib/actions/servicio-gestionado-actions";

export function CulminarRegistroBoton({ registroAvanceId }: { registroAvanceId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleClick() {
    if (!(await confirmar("¿Culminar este registro? Ya no podrás añadir ítems, registrar avance ni editar sustentos."))) return;
    startTransition(async () => {
      const resultado = await culminarRegistroAvanceAction(registroAvanceId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Registro culminado");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={handleClick}>
      Culminar Registro
    </Button>
  );
}
