"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import type { PalletActionState } from "@/lib/actions/pallet-actions";

/** Botón de cierre manual, usado en Tarjas y Tarjas IQF (ver lib/actions/pallet-actions.ts). */
export function CerrarPalletBoton({
  palletId,
  estado,
  accion,
}: {
  palletId: string;
  estado: "ABIERTO" | "CERRADO";
  accion: (palletId: string) => Promise<PalletActionState>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const confirmar = useConfirm();

  if (estado === "CERRADO") {
    return null;
  }

  async function cerrar() {
    if (!(await confirmar("¿Cerrar este pallet? Ya no se le podrán asignar más bandejas."))) return;
    startTransition(async () => {
      const resultado = await accion(palletId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Pallet cerrado");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={cerrar} disabled={isPending}>
      <Lock className="mr-2 h-4 w-4" />
      {isPending ? "Cerrando..." : "Cerrar pallet"}
    </Button>
  );
}
