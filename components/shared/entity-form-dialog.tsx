"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PrimaryButton, IconButton } from "@/components/ui/buttons";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type EntityFormState = { error?: string; success?: boolean } | undefined;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Envuelve el esqueleto repetido en los *-form-dialog.tsx: Dialog +
 * useFormState + toast de éxito (cierra el diálogo al terminar) + botón de
 * envío con "Guardando...". Los campos del formulario los sigue armando
 * cada *-form-dialog.tsx vía `children` — este componente no absorbe
 * ninguna lógica de negocio (server action, validación zod, mensaje de
 * toast específico) ni el gating por rol, que sigue en el padre que decide
 * si renderiza el *FormDialog (ver DESIGN_SYSTEM.md).
 */
export function EntityFormDialog({
  esEdicion,
  action,
  entidad,
  textoBotonCrear = `Nuevo ${entidad}`,
  textoBotonEnviarCrear = `Crear ${entidad}`,
  textoBotonEnviarEditar = "Guardar cambios",
  mensajeExitoCrear = `${capitalizar(entidad)} creado`,
  mensajeExitoEditar = `${capitalizar(entidad)} actualizado`,
  children,
}: {
  esEdicion: boolean;
  action: (state: EntityFormState, formData: FormData) => Promise<EntityFormState>;
  /** Nombre de la entidad en minúscula y singular, ej. "tipo de bandeja" — arma los textos default (título, botones, toast). */
  entidad: string;
  textoBotonCrear?: string;
  textoBotonEnviarCrear?: string;
  textoBotonEnviarEditar?: string;
  mensajeExitoCrear?: string;
  mensajeExitoEditar?: string;
  children: (state: EntityFormState) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState<EntityFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? mensajeExitoEditar : mensajeExitoCrear);
      setOpen(false);
    }
  }, [state, esEdicion, mensajeExitoEditar, mensajeExitoCrear]);

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
            {textoBotonCrear}
          </PrimaryButton>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? `Editar ${entidad}` : `Nuevo ${entidad}`}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {children(state)}

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton esEdicion={esEdicion} textoCrear={textoBotonEnviarCrear} textoEditar={textoBotonEnviarEditar} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ esEdicion, textoCrear, textoEditar }: { esEdicion: boolean; textoCrear: string; textoEditar: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Guardando..." : esEdicion ? textoEditar : textoCrear}
    </PrimaryButton>
  );
}
