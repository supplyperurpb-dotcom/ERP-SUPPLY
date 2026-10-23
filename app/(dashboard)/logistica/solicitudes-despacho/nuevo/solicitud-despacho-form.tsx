"use client";

import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkuCombobox } from "@/components/shared/sku-combobox";
import { fechaLocalHoy, formatCantidad } from "@/lib/utils";
import { AREAS_EMPRESA, type AreaEmpresaCodigo } from "@/lib/constants/compras";
import { solicitudDespachoSchema, type SolicitudDespachoInput } from "@/lib/validations/solicitud-despacho";
import { crearSolicitudDespachoAction } from "@/lib/actions/solicitud-despacho-actions";

type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string; disponible: number };

function itemVacio(centroCostoInicial: string) {
  return { skuId: "", cantidad: 0, unidadMedida: "", centroCosto: centroCostoInicial, campo: "" };
}

export function SolicitudDespachoForm({
  skus,
  areaInicial = "PRODUCCION",
  usuarioNombre,
  centrosCosto,
  campos,
}: {
  skus: SkuOpcion[];
  areaInicial?: AreaEmpresaCodigo;
  usuarioNombre: string;
  centrosCosto: string[];
  campos: string[];
}) {
  const router = useRouter();
  const skuPorId = new Map(skus.map((s) => [s.id, s]));
  const centroCostoInicial = centrosCosto[0] ?? "";

  const form = useForm<SolicitudDespachoInput>({
    resolver: zodResolver(solicitudDespachoSchema),
    defaultValues: {
      area: areaInicial,
      fecha: fechaLocalHoy() as unknown as Date,
      observaciones: "",
      items: [itemVacio(centroCostoInicial)],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];

  async function onSubmit(data: SolicitudDespachoInput) {
    const excedeAlgunaLinea = data.items.some((item) => item.cantidad > (skuPorId.get(item.skuId)?.disponible ?? 0));
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible. Corrígelo antes de guardar.");
      return;
    }

    let resultado;
    try {
      resultado = await crearSolicitudDespachoAction(data);
    } catch (err) {
      console.error("Error al guardar la solicitud de despacho:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Solicitud registrada");
    if (resultado?.id) {
      window.open(`/api/pdf/solicitud-despacho/${resultado.id}`, "_blank");
      router.push(`/logistica/solicitudes-despacho/${resultado.id}`);
    } else {
      router.push("/logistica/solicitudes-despacho");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la solicitud</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Input disabled value={usuarioNombre} />
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <Controller
              control={form.control}
              name="area"
              render={({ field }) => (
                <Select value={field.value} disabled>
                  <SelectTrigger className="cursor-not-allowed bg-muted opacity-70">
                    <SelectValue>{AREAS_EMPRESA.find((a) => a.valor === field.value)?.nombre}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS_EMPRESA.map((a) => (
                      <SelectItem key={a.valor} value={a.valor}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">Fijada según tu área asignada.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de emisión</Label>
            <Input id="fecha" type="date" disabled {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Productos</CardTitle>
            <p className="text-sm text-muted-foreground">Solo aparecen productos con stock disponible en algún almacén.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append(itemVacio(centroCostoInicial))}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead className="min-w-[200px]">Producto</TableHead>
                  <TableHead className="w-28">Cantidad</TableHead>
                  <TableHead className="w-20">U.M.</TableHead>
                  <TableHead className="w-28">Disponible</TableHead>
                  <TableHead className="w-44">Centro de costo</TableHead>
                  <TableHead className="w-40">Campo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const skuId = items[index]?.skuId ?? "";
                  const disponible = skuPorId.get(skuId)?.disponible ?? 0;
                  const cantidad = Number(items[index]?.cantidad) || 0;
                  const excede = skuId !== "" && cantidad > disponible;
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="align-top">
                        <Input disabled value={skuPorId.get(skuId)?.codigo ?? ""} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Controller
                          control={form.control}
                          name={`items.${index}.skuId`}
                          render={({ field: selectField }) => (
                            <SkuCombobox
                              skus={skus}
                              value={selectField.value}
                              emptyMessage="No hay productos con stock disponible."
                              onSelect={(sku) => {
                                selectField.onChange(sku.id);
                                form.setValue(`items.${index}.unidadMedida`, sku.unidadMedida);
                              }}
                            />
                          )}
                        />
                        {form.formState.errors.items?.[index]?.skuId && (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            {form.formState.errors.items[index]?.skuId?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Controller
                          control={form.control}
                          name={`items.${index}.cantidad`}
                          render={({ field: cantidadField }) => (
                            <NumberInput
                              value={String(cantidadField.value ?? "")}
                              onChange={cantidadField.onChange}
                              className={excede ? "border-destructive focus-visible:ring-destructive" : undefined}
                            />
                          )}
                        />
                        {form.formState.errors.items?.[index]?.cantidad && (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            {form.formState.errors.items[index]?.cantidad?.message}
                          </p>
                        )}
                        {excede && (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            Excede lo disponible ({formatCantidad(disponible)}).
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                        {items[index]?.unidadMedida || "—"}
                      </TableCell>
                      <TableCell className="align-top pt-4 text-sm">{skuId ? formatCantidad(disponible) : "—"}</TableCell>
                      <TableCell className="align-top">
                        <Controller
                          control={form.control}
                          name={`items.${index}.centroCosto`}
                          render={({ field: selectField }) => (
                            <Select value={selectField.value} onValueChange={selectField.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {centrosCosto.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {form.formState.errors.items?.[index]?.centroCosto && (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            {form.formState.errors.items[index]?.centroCosto?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Controller
                          control={form.control}
                          name={`items.${index}.campo`}
                          render={({ field: selectField }) => (
                            <Select
                              value={selectField.value || "__ninguno__"}
                              onValueChange={(v) => selectField.onChange(v === "__ninguno__" ? "" : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ninguno__">—</SelectItem>
                                {campos.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                      <TableCell className="align-top">
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando..." : "Registrar solicitud"}
        </Button>
      </div>
    </form>
  );
}
