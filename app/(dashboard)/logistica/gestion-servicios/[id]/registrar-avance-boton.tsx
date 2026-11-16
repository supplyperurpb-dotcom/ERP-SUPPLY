"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { crearRegistroAvanceAction } from "@/lib/actions/servicio-gestionado-actions";

// Crea una nueva sesión numerada y navega directo a ella (ver
// crearRegistroAvanceAction) — cada clic es un "Registro de Avance" nuevo.
export function RegistrarAvanceBoton({ servicioGestionadoId, ordenCompraId }: { servicioGestionadoId: string; ordenCompraId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const resultado = await crearRegistroAvanceAction(servicioGestionadoId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      router.push(`/logistica/gestion-servicios/${ordenCompraId}/registro/${resultado!.numero}`);
    });
  }

  return (
    <Button disabled={pending} onClick={handleClick}>
      Registrar Avance
    </Button>
  );
}
