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
import { CONDICIONES_PAGO, CONDICION_PAGO_POR_DEFECTO } from "@/lib/constants/compras";
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

  const [procedencia, setProcedencia] = useState<"NACIONAL" | "EXTRANJERO">(proveedor?.procedencia ?? "NACIONAL");
  const [tipoDocumento, setTipoDocumento] = useState<"RUC" | "DNI" | "EXTRANJERO">(proveedor?.tipoDocumento ?? "RUC");

  useEffect(() => {
    if (state?.success) {
      toast.success(esEdicion ? "Proveedor actualizado" : "Proveedor creado");
      setOpen(false);
    }
  }, [state, esEdicion]);

  function cambiarProcedencia(valor: "NACIONAL" | "EXTRANJERO") {
    setProcedencia(valor);
    // Un proveedor del extranjero no tiene RUC/DNI: su documento queda
    // fijo en "EXTRANJERO" (ver proveedorSchema, que no le exige formato).
    // Uno nacional vuelve a RUC por defecto.
    setTipoDocumento(valor === "EXTRANJERO" ? "EXTRANJERO" : "RUC");
  }

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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="procedencia">Procedencia</Label>
              <Select name="procedencia" value={procedencia} onValueChange={cambiarProcedencia}>
                <SelectTrigger id="procedencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NACIONAL">Nacional</SelectItem>
                  <SelectItem value="EXTRANJERO">Extranjero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipoDocumento">Tipo de documento</Label>
              {procedencia === "EXTRANJERO" ? (
                <>
                  <Input disabled className="cursor-not-allowed bg-muted opacity-70" value="Extranjero" />
                  <input type="hidden" name="tipoDocumento" value="EXTRANJERO" />
                </>
              ) : (
                <Select name="tipoDocumento" value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v as "RUC" | "DNI")}>
                  <SelectTrigger id="tipoDocumento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RUC">RUC</SelectItem>
                    <SelectItem value="DNI">DNI</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numeroDocumento">
              {procedencia === "EXTRANJERO" ? "Código / identificador tributario" : "Número de documento"}
            </Label>
            <Input
              id="numeroDocumento"
              name="numeroDocumento"
              defaultValue={proveedor?.numeroDocumento}
              required
              readOnly={esEdicion}
              className={esEdicion ? "cursor-not-allowed bg-muted opacity-70" : undefined}
            />
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

          <div className="grid grid-cols-2 gap-4">
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
              <p className="text-xs text-muted-foreground">Fundo/Ambos es lo que Acopio ofrece como proveedor de fruta.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubro">Rubro / actividad económica (opcional)</Label>
              <Input id="rubro" name="rubro" defaultValue={proveedor?.rubro ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condicionPago">Condición de pago</Label>
            <Select name="condicionPago" defaultValue={proveedor?.condicionPago ?? CONDICION_PAGO_POR_DEFECTO}>
              <SelectTrigger id="condicionPago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDICIONES_PAGO.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se precarga al generar una Orden de Compra para este proveedor (se puede cambiar ahí sin afectar este valor).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" name="direccion" defaultValue={proveedor?.direccion ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lugar">Lugar (opcional)</Label>
              <Input id="lugar" name="lugar" defaultValue={proveedor?.lugar ?? ""} placeholder="Ciudad / región / país" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" defaultValue={proveedor?.telefono ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={proveedor?.email ?? ""} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactoNombre">Nombre de contacto</Label>
            <Input id="contactoNombre" name="contactoNombre" defaultValue={proveedor?.contactoNombre ?? ""} required />
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
