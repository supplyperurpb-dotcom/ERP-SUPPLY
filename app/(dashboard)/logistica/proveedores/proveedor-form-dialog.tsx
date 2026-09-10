"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Proveedor } from "@prisma/client";
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
import { TIPOS_PROVEEDOR } from "@/lib/validations/proveedor";
import {
  crearProveedorAction,
  actualizarProveedorAction,
  type ProveedorActionState,
} from "@/lib/actions/proveedor-actions";

export function ProveedorFormDialog({ proveedor }: { proveedor?: Proveedor }) {
  const [open, setOpen] = useState(false);
  const esEdicion = !!proveedor;
  const action = esEdicion ? actualizarProveedorAction.bind(null, proveedor.id) : crearProveedorAction;
  const [state, formAction] = useFormState<ProveedorActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Proveedor actualizado" : "Proveedor creado");
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
            Nuevo proveedor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoDocumento">Tipo de documento</Label>
              <Select name="tipoDocumento" defaultValue={proveedor?.tipoDocumento ?? "RUC"}>
                <SelectTrigger id="tipoDocumento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUC">RUC</SelectItem>
                  <SelectItem value="DNI">DNI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numeroDocumento">Número de documento</Label>
              <Input
                id="numeroDocumento"
                name="numeroDocumento"
                defaultValue={proveedor?.numeroDocumento}
                required
                disabled={esEdicion}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razonSocial">Razón social</Label>
              <Input id="razonSocial" name="razonSocial" defaultValue={proveedor?.razonSocial} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombreComercial">Nombre comercial (opcional)</Label>
              <Input id="nombreComercial" name="nombreComercial" defaultValue={proveedor?.nombreComercial ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de proveedor</Label>
            <Select name="tipo" defaultValue={proveedor?.tipo ?? "INSUMOS"}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PROVEEDOR.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección (opcional)</Label>
              <Input id="direccion" name="direccion" defaultValue={proveedor?.direccion ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distrito">Distrito (opcional)</Label>
              <Input id="distrito" name="distrito" defaultValue={proveedor?.distrito ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provincia">Provincia (opcional)</Label>
              <Input id="provincia" name="provincia" defaultValue={proveedor?.provincia ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento (opcional)</Label>
              <Input id="departamento" name="departamento" defaultValue={proveedor?.departamento ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input id="telefono" name="telefono" defaultValue={proveedor?.telefono ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input id="email" name="email" type="email" defaultValue={proveedor?.email ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactoNombre">Nombre de contacto (opcional)</Label>
            <Input id="contactoNombre" name="contactoNombre" defaultValue={proveedor?.contactoNombre ?? ""} />
          </div>

          <input type="hidden" name="activo" value={(proveedor?.activo ?? true) ? "true" : "false"} />

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
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear proveedor"}
    </Button>
  );
}
