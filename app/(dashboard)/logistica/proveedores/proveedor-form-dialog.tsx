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
import { BANCOS_PROVEEDOR } from "@/lib/validations/proveedor";
import { CONDICIONES_PAGO, CONDICION_PAGO_POR_DEFECTO } from "@/lib/constants/compras";
import {
  crearProveedorAction,
  actualizarProveedorAction,
  type ProveedorActionState,
} from "@/lib/actions/proveedor-actions";

const SIN_BANCO = "__sin_banco__";
const OTRO_BANCO = "OTRO";

export function ProveedorFormDialog({ proveedor }: { proveedor?: Proveedor }) {
  const [open, setOpen] = useState(false);
  const esEdicion = !!proveedor;
  const action = esEdicion ? actualizarProveedorAction.bind(null, proveedor.id) : crearProveedorAction;
  const [state, formAction] = useFormState<ProveedorActionState, FormData>(action, undefined);

  const [procedencia, setProcedencia] = useState<"NACIONAL" | "EXTRANJERO">(proveedor?.procedencia ?? "NACIONAL");
  const [tipoDocumento, setTipoDocumento] = useState<"RUC" | "DNI" | "EXTRANJERO">(proveedor?.tipoDocumento ?? "RUC");

  // Banco: si el valor guardado está en la lista fija, el select arranca
  // en ese banco; si no (texto libre escrito al elegir "Otro"), el select
  // arranca en "Otro" y el texto precarga el input que aparece al lado.
  const bancoGuardado = proveedor?.banco ?? "";
  const bancoListado = (BANCOS_PROVEEDOR as readonly string[]).includes(bancoGuardado);
  const [bancoSeleccion, setBancoSeleccion] = useState<string>(
    bancoGuardado === "" ? SIN_BANCO : bancoListado ? bancoGuardado : OTRO_BANCO
  );
  const [bancoOtro, setBancoOtro] = useState(bancoListado ? "" : bancoGuardado);

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

          <div className="space-y-2">
            <Label htmlFor="rubro">Rubro / actividad económica</Label>
            <Input id="rubro" name="rubro" defaultValue={proveedor?.rubro ?? ""} required />
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
              <Label htmlFor="banco">Banco (opcional)</Label>
              <Select
                value={bancoSeleccion}
                onValueChange={(v) => {
                  setBancoSeleccion(v);
                  if (v !== OTRO_BANCO) setBancoOtro("");
                }}
              >
                <SelectTrigger id="banco">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_BANCO}>—</SelectItem>
                  {BANCOS_PROVEEDOR.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTRO_BANCO}>Otro</SelectItem>
                </SelectContent>
              </Select>
              {bancoSeleccion === OTRO_BANCO && (
                <Input
                  name="banco"
                  value={bancoOtro}
                  onChange={(e) => setBancoOtro(e.target.value)}
                  placeholder="Nombre del banco"
                  className="mt-2"
                />
              )}
              {bancoSeleccion !== OTRO_BANCO && (
                <input type="hidden" name="banco" value={bancoSeleccion === SIN_BANCO ? "" : bancoSeleccion} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="numeroCuenta">Número de cuenta (opcional)</Label>
              <Input id="numeroCuenta" name="numeroCuenta" defaultValue={proveedor?.numeroCuenta ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" name="direccion" defaultValue={proveedor?.direccion ?? ""} required />
          </div>

          {procedencia === "EXTRANJERO" ? (
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <Input id="pais" name="pais" defaultValue={proveedor?.pais ?? ""} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input id="departamento" name="departamento" defaultValue={proveedor?.departamento ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Input id="provincia" name="provincia" defaultValue={proveedor?.provincia ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distrito">Distrito</Label>
                <Input id="distrito" name="distrito" defaultValue={proveedor?.distrito ?? ""} />
              </div>
            </div>
          )}

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
