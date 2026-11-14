"use client";

import { useState } from "react";
import type { TipoBandeja } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { EntityFormDialog } from "@/components/shared/entity-form-dialog";
import { crearTipoBandejaAction, actualizarTipoBandejaAction } from "@/lib/actions/tara-actions";

export function TipoBandejaFormDialog({ tipoBandeja }: { tipoBandeja?: TipoBandeja }) {
  const [pesoTaraKg, setPesoTaraKg] = useState(tipoBandeja?.pesoTaraKg.toString() ?? "");
  const esEdicion = !!tipoBandeja;
  const action = esEdicion ? actualizarTipoBandejaAction.bind(null, tipoBandeja.id) : crearTipoBandejaAction;

  return (
    <EntityFormDialog esEdicion={esEdicion} action={action} entidad="tipo de bandeja">
      {() => (
        <>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={tipoBandeja?.nombre}
              required
              readOnly={esEdicion}
              className={esEdicion ? "cursor-not-allowed bg-muted opacity-70" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pesoTaraKg">Peso tara (kg)</Label>
            <NumberInput id="pesoTaraKg" name="pesoTaraKg" value={pesoTaraKg} onChange={setPesoTaraKg} required />
          </div>

          <input type="hidden" name="activo" value={(tipoBandeja?.activo ?? true) ? "true" : "false"} />
        </>
      )}
    </EntityFormDialog>
  );
}
