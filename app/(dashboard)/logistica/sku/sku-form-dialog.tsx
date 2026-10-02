"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
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
import { UNIDADES_MEDIDA, CATEGORIAS_SKU, SUBFAMILIAS_SKU } from "@/lib/validations/sku";
import { actualizarSkuAction, type SkuActionState } from "@/lib/actions/sku-actions";

// Solo edición: crear un SKU nuevo ahora pasa por uno de los 3 flujos de
// /logistica/sku/nuevo/{suministros,agroquimicos,servicios}, cada uno con
// su propia regla de generación de código.
export function SkuFormDialog({ sku }: { sku: Sku }) {
  const [open, setOpen] = useState(false);
  const action = actualizarSkuAction.bind(null, sku.id);
  const [state, formAction] = useFormState<SkuActionState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("SKU actualizado");
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar SKU</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                name="codigo"
                defaultValue={sku.codigo}
                required
                readOnly
                className="cursor-not-allowed bg-muted opacity-70"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input id="categoria" name="categoria" list="categorias-sku" defaultValue={sku.categoria} required />
              <datalist id="categorias-sku">
                {CATEGORIAS_SKU.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input id="descripcion" name="descripcion" defaultValue={sku.descripcion} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unidadMedida">Unidad de medida</Label>
              <Select name="unidadMedida" defaultValue={sku.unidadMedida}>
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
              <Label htmlFor="subfamilia">Subfamilia</Label>
              <Input id="subfamilia" name="subfamilia" list="subfamilias-sku" defaultValue={sku.subfamilia} required />
              <datalist id="subfamilias-sku">
                {SUBFAMILIAS_SKU.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
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
              defaultValue={sku.stockMinimo?.toString()}
            />
          </div>

          <input type="hidden" name="activo" value={sku.activo ? "true" : "false"} />

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : "Guardar cambios"}
    </Button>
  );
}
