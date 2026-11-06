"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Camion } from "@prisma/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_CAMION } from "@/lib/validations/transporte";
import { crearCamionAction, actualizarCamionAction, type TransporteActionState } from "@/lib/actions/transporte-actions";

export function CamionFormDialog({ camion }: { camion?: Camion }) {
  const [open, setOpen] = useState(false);
  const esEdicion = !!camion;
  const action = esEdicion ? actualizarCamionAction.bind(null, camion.id) : crearCamionAction;
  const [state, formAction] = useFormState<TransporteActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Camión actualizado" : "Camión creado");
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
            Nuevo camión
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar camión" : "Nuevo camión"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
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
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear camión"}
    </Button>
  );
}
