"use client";

import { useEffect } from "react";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatKg } from "@/lib/utils";
import { ingresoFrutaSchema, type IngresoFrutaInput } from "@/lib/validations/ingreso-fruta";
import { crearIngresoFrutaAction } from "@/lib/actions/ingreso-fruta-actions";

type ProveedorOption = { id: string; razonSocial: string };
type TipoBandejaOption = { id: string; nombre: string; pesoTaraKg: string };

const LINEA_VACIA = {
  modulo: "",
  turno: "",
  variedad: "",
  tipoBandejaId: "",
  cantidadBandejas: 0,
  pesoBrutoTotalKg: 0,
};

export function IngresoFrutaForm({
  proveedores,
  tiposBandeja,
}: {
  proveedores: ProveedorOption[];
  tiposBandeja: TipoBandejaOption[];
}) {
  const router = useRouter();
  const taraPorTipo = new Map(tiposBandeja.map((t) => [t.id, Number(t.pesoTaraKg)]));

  const form = useForm<IngresoFrutaInput>({
    resolver: zodResolver(ingresoFrutaSchema),
    defaultValues: {
      proveedorId: "",
      lote: "",
      horaIngreso: "",
      placaTransporte: "",
      observaciones: "",
      pallets: [LINEA_VACIA],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "pallets" });
  const pallets = useWatch({ control: form.control, name: "pallets" });

  const filasCalculadas = (pallets ?? []).map((pallet) => {
    const taraUnitaria = taraPorTipo.get(pallet?.tipoBandejaId ?? "") ?? 0;
    const cantidad = Number(pallet?.cantidadBandejas) || 0;
    const pesoBruto = Number(pallet?.pesoBrutoTotalKg) || 0;
    const pesoTara = cantidad * taraUnitaria;
    const pesoNeto = pesoBruto - pesoTara;
    return { pesoTara, pesoNeto };
  });

  const totales = filasCalculadas.reduce(
    (acc, fila, i) => ({
      cantidadBandejas: acc.cantidadBandejas + (Number(pallets?.[i]?.cantidadBandejas) || 0),
      pesoBruto: acc.pesoBruto + (Number(pallets?.[i]?.pesoBrutoTotalKg) || 0),
      pesoNeto: acc.pesoNeto + fila.pesoNeto,
    }),
    { cantidadBandejas: 0, pesoBruto: 0, pesoNeto: 0 }
  );

  useEffect(() => {
    const errorPallets = form.formState.errors.pallets;
    if (errorPallets && !Array.isArray(errorPallets)) {
      toast.error(errorPallets.message ?? "Revisa las líneas de pesaje");
    }
  }, [form.formState.errors.pallets]);

  async function onSubmit(data: IngresoFrutaInput) {
    const resultado = await crearIngresoFrutaAction(data);
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Ingreso de materia prima registrado");
    router.push("/acopio/ingresos");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del camión</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Proveedor / Fundo</Label>
            <Controller
              control={form.control}
              name="proveedorId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un fundo" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.razonSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.proveedorId && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.proveedorId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="placaTransporte">Placa del vehículo</Label>
            <Input id="placaTransporte" placeholder="Ej. ABC-123" {...form.register("placaTransporte")} />
            {form.formState.errors.placaTransporte && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.placaTransporte.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="horaIngreso">Hora de recepción</Label>
            <Input id="horaIngreso" type="time" {...form.register("horaIngreso")} />
            {form.formState.errors.horaIngreso && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaIngreso.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lote">Lote</Label>
            <Input id="lote" placeholder="Ej. L-2026-0001" {...form.register("lote")} />
            {form.formState.errors.lote && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.lote.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fechaCosecha">Fecha de cosecha</Label>
            <Input id="fechaCosecha" type="date" {...form.register("fechaCosecha")} />
            {form.formState.errors.fechaCosecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fechaCosecha.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Líneas de pesaje</CardTitle>
            <p className="text-sm text-muted-foreground">
              Un camión puede traer fruta de más de un módulo, turno o variedad — agrega una línea por
              cada grupo de bandejas con su propia trazabilidad.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append(LINEA_VACIA)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Línea {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Módulo</Label>
                  <Input placeholder="Ej. Módulo 3" {...form.register(`pallets.${index}.modulo`)} />
                  {form.formState.errors.pallets?.[index]?.modulo && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.pallets[index]?.modulo?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Turno</Label>
                  <Input placeholder="Ej. Turno 2" {...form.register(`pallets.${index}.turno`)} />
                  {form.formState.errors.pallets?.[index]?.turno && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.pallets[index]?.turno?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Variedad</Label>
                  <Input placeholder="Ej. Biloxi" {...form.register(`pallets.${index}.variedad`)} />
                  {form.formState.errors.pallets?.[index]?.variedad && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.pallets[index]?.variedad?.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-3" />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Tipo de bandeja</Label>
                  <Controller
                    control={form.control}
                    name={`pallets.${index}.tipoBandejaId`}
                    render={({ field: selectField }) => (
                      <Select value={selectField.value} onValueChange={selectField.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposBandeja.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.pallets?.[index]?.tipoBandejaId && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.pallets[index]?.tipoBandejaId?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cant. bandejas</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    {...form.register(`pallets.${index}.cantidadBandejas`)}
                  />
                  {form.formState.errors.pallets?.[index]?.cantidadBandejas && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.pallets[index]?.cantidadBandejas?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso bruto (kg)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    {...form.register(`pallets.${index}.pesoBrutoTotalKg`)}
                  />
                  {form.formState.errors.pallets?.[index]?.pesoBrutoTotalKg && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.pallets[index]?.pesoBrutoTotalKg?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso neto</Label>
                  <p className="flex h-10 items-center text-sm font-semibold text-primary">
                    {formatKg(filasCalculadas[index]?.pesoNeto ?? 0)}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tara: {formatKg(filasCalculadas[index]?.pesoTara ?? 0)}
              </p>
            </div>
          ))}

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Total de bandejas: <span className="font-medium">{totales.cantidadBandejas}</span>
            </p>
            <p>
              Peso bruto total: <span className="font-medium">{formatKg(totales.pesoBruto)}</span>
            </p>
            <p className="text-base">
              Peso neto total: <span className="font-semibold text-primary">{formatKg(totales.pesoNeto)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando..." : "Registrar ingreso"}
        </Button>
      </div>
    </form>
  );
}
