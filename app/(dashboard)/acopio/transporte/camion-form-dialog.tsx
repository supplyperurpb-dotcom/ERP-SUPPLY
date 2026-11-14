"use client";

import type { Camion } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityFormDialog } from "@/components/shared/entity-form-dialog";
import { TIPOS_CAMION } from "@/lib/validations/transporte";
import { TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE } from "@/lib/validations/vehiculo-transporte";
import { crearCamionAction, actualizarCamionAction } from "@/lib/actions/transporte-actions";

export function CamionFormDialog({ camion }: { camion?: Camion }) {
  const esEdicion = !!camion;
  const action = esEdicion ? actualizarCamionAction.bind(null, camion.id) : crearCamionAction;

  return (
    <EntityFormDialog esEdicion={esEdicion} action={action} entidad="camión">
      {() => (
        <>
          <div className="space-y-2">
            <Label htmlFor="placa">Placa</Label>
            <Input id="placa" name="placa" placeholder="Ej. ABC-123" defaultValue={camion?.placa} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de camión</Label>
            <Select name="tipo" defaultValue={camion?.tipo ?? "CAMION_KIA"}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CAMION.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoPropiedad">Tipo</Label>
            <Select name="tipoPropiedad" defaultValue={camion?.tipoPropiedad ?? "TERCERO"}>
              <SelectTrigger id="tipoPropiedad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </EntityFormDialog>
  );
}
