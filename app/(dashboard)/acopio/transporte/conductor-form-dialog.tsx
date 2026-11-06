"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Conductor } from "@prisma/client";
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
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo conductor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar conductor" : "Nuevo conductor"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proveedorId">Proveedor (empresa de transporte)</Label>
            <Select name="proveedorId" value={proveedorId} onValueChange={setProveedorId}>
              <SelectTrigger id="proveedorId">
                <SelectValue placeholder="Selecciona un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.razonSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {proveedores.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay proveedores con tipo &quot;Transporte&quot;. Créalos en Logística &gt; Proveedores.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruc">RUC</Label>
            <Input id="ruc" value={ruc} disabled readOnly className="cursor-not-allowed bg-muted opacity-70" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del conductor</Label>
            <Input id="nombre" name="nombre" defaultValue={conductor?.nombre} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input id="dni" name="dni" defaultValue={conductor?.dni} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="licenciaConducir">Licencia de conducir</Label>
            <Input id="licenciaConducir" name="licenciaConducir" defaultValue={conductor?.licenciaConducir} required />
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
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear conductor"}
    </Button>
  );
}
