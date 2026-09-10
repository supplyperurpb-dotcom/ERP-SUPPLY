"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { TipoPallet } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  crearTipoPalletAction,
  actualizarTipoPalletAction,
  type TaraActionState,
} from "@/lib/actions/tara-actions";

export function TipoPalletFormDialog({ tipoPallet }: { tipoPallet?: TipoPallet }) {
  const [open, setOpen] = useState(false);
  const esEdicion = !!tipoPallet;
  const action = esEdicion ? actualizarTipoPalletAction.bind(null, tipoPallet.id) : crearTipoPalletAction;
  const [state, formAction] = useFormState<TaraActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Tipo de pallet actualizado" : "Tipo de pallet creado");
      setOpen(false);
    }
  }, [state, esEdicion]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {esEdicion ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo tipo de pallet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar tipo de pallet" : "Nuevo tipo de pallet"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              defaultValue={tipoPallet?.nombre}
              required
              disabled={esEdicion}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pesoTaraKg">Peso tara (kg)</Label>
            <Input
              id="pesoTaraKg"
              name="pesoTaraKg"
              type="number"
              step="0.001"
              min={0}
              defaultValue={tipoPallet?.pesoTaraKg.toString()}
              required
            />
          </div>

          <input type="hidden" name="activo" value={(tipoPallet?.activo ?? true) ? "true" : "false"} />

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
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear tipo de pallet"}
    </Button>
  );
}
