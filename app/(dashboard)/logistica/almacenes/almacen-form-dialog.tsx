"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Almacen } from "@prisma/client";
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
import { crearAlmacenAction, actualizarAlmacenAction, type AlmacenActionState } from "@/lib/actions/almacen-actions";

const TIPO_LABEL: Record<string, string> = {
  INSUMOS: "Insumos",
  AGROQUIMICOS: "Agroquímicos",
  MATERIAL_EMPAQUE: "Material de empaque",
  CAMARA_FRIO: "Cámara de frío",
  OTRO: "Otro",
};

export function AlmacenFormDialog({ almacen }: { almacen?: Almacen }) {
  const [open, setOpen] = useState(false);
  const esEdicion = !!almacen;
  const action = esEdicion ? actualizarAlmacenAction.bind(null, almacen.id) : crearAlmacenAction;
  const [state, formAction] = useFormState<AlmacenActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Almacén actualizado" : "Almacén creado");
      setOpen(false);
    }
  }, [state, esEdicion]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {esEdicion ? (
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo almacén
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar almacén" : "Nuevo almacén"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" name="codigo" defaultValue={almacen?.codigo} required disabled={esEdicion} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select name="tipo" defaultValue={almacen?.tipo ?? "OTRO"}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={almacen?.nombre} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ubicacion">Ubicación (opcional)</Label>
            <Input id="ubicacion" name="ubicacion" defaultValue={almacen?.ubicacion ?? ""} />
          </div>

          <input type="hidden" name="activo" value={(almacen?.activo ?? true) ? "true" : "false"} />

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
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear almacén"}
    </Button>
  );
}
