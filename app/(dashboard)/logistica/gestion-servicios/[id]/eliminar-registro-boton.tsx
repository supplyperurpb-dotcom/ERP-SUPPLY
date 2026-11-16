"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import { eliminarRegistroAvanceAction } from "@/lib/actions/servicio-gestionado-actions";

// `volverA`: dentro de la propia vista del registro, al eliminarlo esa
// ruta deja de existir — hay que navegar a la landing de la OS en vez de
// solo refrescar (ver [id]/registro/[numero]/page.tsx).
export function EliminarRegistroBoton({
  registroAvanceId,
  numero,
  volverA,
}: {
  registroAvanceId: string;
  numero: number;
  volverA?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleClick() {
    if (
      !(await confirmar(
        `¿Eliminar el Registro de Avance ${numero}? Se borrarán sus ítems, avances y sustentos. Esta acción no se puede deshacer.`
      ))
    )
      return;
    startTransition(async () => {
      const resultado = await eliminarRegistroAvanceAction(registroAvanceId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Registro eliminado");
      if (volverA) {
        router.push(volverA);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleClick} className="text-destructive hover:text-destructive">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
