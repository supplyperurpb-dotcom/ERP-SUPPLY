"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palmtree } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import { alternarVacacionesAction } from "@/lib/actions/perfil-actions";

export function VacacionesBoton({ enVacaciones }: { enVacaciones: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleClick() {
    const mensaje = enVacaciones
      ? "¿Quitar tu marca de vacaciones? Volverás a resolver tus aprobaciones pendientes tú mismo."
      : "¿Marcarte de vacaciones? Mientras estés de vacaciones, tus aprobaciones pendientes las resolverá tu reemplazo según la política de la empresa.";
    if (!(await confirmar(mensaje))) return;
    startTransition(async () => {
      const resultado = await alternarVacacionesAction(!enVacaciones);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(enVacaciones ? "Ya no estás de vacaciones" : "Quedaste marcado de vacaciones");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={enVacaciones ? "default" : "outline"}
      disabled={pending}
      onClick={handleClick}
    >
      <Palmtree className="mr-2 h-4 w-4" />
      {enVacaciones ? "De vacaciones (click para quitar)" : "Vacaciones"}
    </Button>
  );
}
