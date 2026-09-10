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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatKg } from "@/lib/utils";
import { ingresoFrutaSchema, type IngresoFrutaInput } from "@/lib/validations/ingreso-fruta";
import { crearIngresoFrutaAction } from "@/lib/actions/ingreso-fruta-actions";

type ProveedorOption = { id: string; razonSocial: string };
type TipoBandejaOption = { id: string; nombre: string; pesoTaraKg: string };

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
      modulo: "",
      turno: "",
      lote: "",
      variedad: "",
      horaIngreso: "",
      placaTransporte: "",
      observaciones: "",
      pallets: [{ tipoBandejaId: "", cantidadBandejas: 0, pesoBrutoTotalKg: 0 }],
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
    if (form.formState.errors.pallets?.root || form.formState.errors.pallets?.message) {
      toast.error(form.formState.errors.pallets.message ?? form.formState.errors.pallets.root?.message);
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
          <CardTitle className="text-base">Trazabilidad de origen</CardTitle>
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
            <Label htmlFor="modulo">Módulo</Label>
            <Input id="modulo" placeholder="Ej. Módulo 3" {...form.register("modulo")} />
            {form.formState.errors.modulo && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.modulo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="turno">Turno</Label>
            <Input id="turno" placeholder="Ej. Turno 2" {...form.register("turno")} />
            {form.formState.errors.turno && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.turno.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variedad">Variedad</Label>
            <Input id="variedad" placeholder="Ej. Biloxi" {...form.register("variedad")} />
            {form.formState.errors.variedad && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.variedad.message}</p>
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

          <div className="space-y-2">
            <Label htmlFor="horaIngreso">Hora de recepción</Label>
            <Input id="horaIngreso" type="time" {...form.register("horaIngreso")} />
            {form.formState.errors.horaIngreso && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaIngreso.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="placaTransporte">Placa del vehículo</Label>
            <Input id="placaTransporte" placeholder="Ej. ABC-123" {...form.register("placaTransporte")} />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Pesaje por bandejas</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ tipoBandejaId: "", cantidadBandejas: 0, pesoBrutoTotalKg: 0 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>Tipo de bandeja</TableHead>
                <TableHead>Cant. bandejas</TableHead>
                <TableHead>Peso bruto (kg)</TableHead>
                <TableHead>Tara (kg)</TableHead>
                <TableHead>Peso neto (kg)</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.tipoBandejaId`}
                      render={({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange}>
                          <SelectTrigger className="min-w-[10rem]">
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
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      step="1"
                      className="w-24"
                      {...form.register(`pallets.${index}.cantidadBandejas`)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      className="w-28"
                      {...form.register(`pallets.${index}.pesoBrutoTotalKg`)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatKg(filasCalculadas[index]?.pesoTara ?? 0)}
                  </TableCell>
                  <TableCell className="font-medium">{formatKg(filasCalculadas[index]?.pesoNeto ?? 0)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col items-end gap-1 border-t pt-4 text-sm">
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
