"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Sku } from "@prisma/client";
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
import { UNIDADES_MEDIDA } from "@/lib/validations/sku";
import { crearSkuAction, actualizarSkuAction, type SkuActionState } from "@/lib/actions/sku-actions";

export function SkuFormDialog({ sku }: { sku?: Sku }) {
  const [open, setOpen] = useState(false);
  const esEdicion = !!sku;
  const action = esEdicion ? actualizarSkuAction.bind(null, sku.id) : crearSkuAction;
  const [state, formAction] = useFormState<SkuActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "SKU actualizado" : "SKU creado");
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
            Nuevo SKU
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar SKU" : "Nuevo SKU"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" name="codigo" defaultValue={sku?.codigo} required disabled={esEdicion} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input id="categoria" name="categoria" defaultValue={sku?.categoria} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input id="descripcion" name="descripcion" defaultValue={sku?.descripcion} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unidadMedida">Unidad de medida</Label>
              <Select name="unidadMedida" defaultValue={sku?.unidadMedida ?? "NIU"}>
                <SelectTrigger id="unidadMedida">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_MEDIDA.map((u) => (
                    <SelectItem key={u.codigo} value={u.codigo}>
                      {u.codigo} — {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select name="tipo" defaultValue={sku?.tipo ?? "INSUMO"}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSUMO">Insumo</SelectItem>
                  <SelectItem value="PRODUCTO_TERMINADO">Producto terminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stockMinimo">Stock mínimo (opcional)</Label>
            <Input
              id="stockMinimo"
              name="stockMinimo"
              type="number"
              step="0.001"
              min={0}
              defaultValue={sku?.stockMinimo?.toString()}
            />
          </div>

          <input type="hidden" name="activo" value={(sku?.activo ?? true) ? "true" : "false"} />

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
      {pending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear SKU"}
    </Button>
  );
}
