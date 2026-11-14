"use client";

import { useState } from "react";
import type { TipoPallet } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { EntityFormDialog } from "@/components/shared/entity-form-dialog";
import { crearTipoPalletAction, actualizarTipoPalletAction } from "@/lib/actions/tara-actions";

export function TipoPalletFormDialog({ tipoPallet }: { tipoPallet?: TipoPallet }) {
  const [pesoTaraKg, setPesoTaraKg] = useState(tipoPallet?.pesoTaraKg.toString() ?? "");
  const esEdicion = !!tipoPallet;
  const action = esEdicion ? actualizarTipoPalletAction.bind(null, tipoPallet.id) : crearTipoPalletAction;

  return (
    <EntityFormDialog esEdicion={esEdicion} action={action} entidad="tipo de pallet">
      {() => (
        <>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={tipoPallet?.nombre}
              required
              readOnly={esEdicion}
              className={esEdicion ? "cursor-not-allowed bg-muted opacity-70" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pesoTaraKg">Peso tara (kg)</Label>
            <NumberInput id="pesoTaraKg" name="pesoTaraKg" value={pesoTaraKg} onChange={setPesoTaraKg} required />
          </div>

          <input type="hidden" name="activo" value={(tipoPallet?.activo ?? true) ? "true" : "false"} />
        </>
      )}
    </EntityFormDialog>
  );
}
