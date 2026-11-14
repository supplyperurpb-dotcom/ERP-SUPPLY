"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Conductor } from "@prisma/client";
import { PrimaryButton, IconButton } from "@/components/ui/buttons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormInput, FormSelect } from "@/components/ui/form-fields";
import { TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE } from "@/lib/validations/vehiculo-transporte";
import {
  crearConductorAction,
  actualizarConductorAction,
  type TransporteActionState,
} from "@/lib/actions/transporte-actions";

export function ConductorFormDialog({ conductor }: { conductor?: Conductor }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState(conductor?.tipo ?? "TERCERO");
  const esEdicion = !!conductor;
  const action = esEdicion ? actualizarConductorAction.bind(null, conductor.id) : crearConductorAction;
  const [state, formAction] = useFormState<TransporteActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Conductor actualizado" : "Conductor creado");
      setOpen(false);
    }
  }, [state, esEdicion]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {esEdicion ? (
          <IconButton>
            <Pencil className="h-4 w-4" />
          </IconButton>
        ) : (
          <PrimaryButton>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo conductor
          </PrimaryButton>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar conductor" : "Nuevo conductor"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <FormSelect
            label="Tipo"
            id="tipo"
            name="tipo"
            value={tipo}
            onValueChange={(v) => setTipo(v as typeof tipo)}
            placeholder="Selecciona el tipo"
            options={TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE.map((t) => ({ value: t.valor, label: t.nombre }))}
          />

          <FormInput label="Nombre del conductor" id="nombre" name="nombre" defaultValue={conductor?.nombre} required />

          <FormInput label="DNI" id="dni" name="dni" defaultValue={conductor?.dni} required />

          <FormInput
            label="Licencia de conducir"
            id="licenciaConducir"
            name="licenciaConducir"
            defaultValue={conductor?.licenciaConducir}
            required
          />

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton esEdicion={esEdicion} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ esEdicion }: { esEdicion: boolean }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear conductor"}
    </PrimaryButton>
  );
}
