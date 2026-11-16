"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decidirVbRegistroAvanceAction } from "@/lib/actions/servicio-gestionado-actions";

// Visible solo para el usuario al que se le pidió el VB (o un ADMIN, ver
// decidirVbRegistroAvanceAction) — observaciones obligatorias solo para
// rechazar, pedido explícito.
export function DecidirVbSection({ registroAvanceId }: { registroAvanceId: string }) {
  const [observaciones, setObservaciones] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDecidir(decision: "APROBADO" | "RECHAZADO") {
    if (decision === "RECHAZADO" && !observaciones.trim()) {
      toast.error("Las observaciones son obligatorias para rechazar.");
      return;
    }
    startTransition(async () => {
      const resultado = await decidirVbRegistroAvanceAction(registroAvanceId, decision, observaciones);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(decision === "APROBADO" ? "Registro aprobado" : "Registro rechazado");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Visto bueno</h2>
      <div className="space-y-1.5">
        <Label htmlFor="observacionesVB">Observaciones</Label>
        <Textarea
          id="observacionesVB"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Obligatorias si rechazas, opcionales si apruebas"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={() => handleDecidir("APROBADO")} className="text-green-700 hover:text-green-800" variant="outline">
          Aprobado
        </Button>
        <Button type="button" disabled={pending} onClick={() => handleDecidir("RECHAZADO")} variant="outline" className="text-destructive hover:text-destructive">
          Rechazado
        </Button>
      </div>
    </div>
  );
}
