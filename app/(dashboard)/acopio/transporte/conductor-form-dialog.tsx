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
import {
  crearConductorAction,
  actualizarConductorAction,
  type TransporteActionState,
} from "@/lib/actions/transporte-actions";

type ProveedorOption = { id: string; razonSocial: string; numeroDocumento: string };

export function ConductorFormDialog({
  conductor,
  proveedores,
}: {
  conductor?: Conductor;
  proveedores: ProveedorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [proveedorId, setProveedorId] = useState(conductor?.proveedorId ?? "");
  const esEdicion = !!conductor;
  const action = esEdicion ? actualizarConductorAction.bind(null, conductor.id) : crearConductorAction;
  const [state, formAction] = useFormState<TransporteActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Conductor actualizado" : "Conductor creado");
      setOpen(false);
    }
  }, [state, esEdicion]);

  const ruc = proveedores.find((p) => p.id === proveedorId)?.numeroDocumento ?? "";

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
            label="Proveedor (empresa de transporte)"
            id="proveedorId"
            name="proveedorId"
            value={proveedorId}
            onValueChange={setProveedorId}
            placeholder="Selecciona un proveedor"
            options={proveedores.map((p) => ({ value: p.id, label: p.razonSocial }))}
            description={
              proveedores.length === 0
                ? 'No hay proveedores con tipo "Transporte". Créalos en Logística > Proveedores.'
                : undefined
            }
          />

          <FormInput
            label="RUC"
            id="ruc"
            value={ruc}
            disabled
            readOnly
            className="cursor-not-allowed bg-muted opacity-70"
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
