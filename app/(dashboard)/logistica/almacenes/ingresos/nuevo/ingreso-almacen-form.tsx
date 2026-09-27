"use client";

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
import { SkuCombobox } from "@/components/shared/sku-combobox";
import { fechaLocalHoy, formatMoneda } from "@/lib/utils";
import { ingresoAlmacenSchema, type IngresoAlmacenInput } from "@/lib/validations/almacen";
import { crearIngresoAlmacenAction } from "@/lib/actions/ingreso-almacen-actions";

type Opcion = { id: string; nombre: string };
type ProveedorOpcion = { id: string; razonSocial: string };
type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string };

const SIN_PROVEEDOR = "__sin_proveedor__";

const ITEM_VACIO = { skuId: "", cantidad: 0, unidadMedida: "", precioUnitario: 0, lote: "" };

export function IngresoAlmacenForm({
  almacenes,
  proveedores,
  skus,
  almacenIdInicial,
}: {
  almacenes: Opcion[];
  proveedores: ProveedorOpcion[];
  skus: SkuOpcion[];
  almacenIdInicial?: string;
}) {
  const router = useRouter();
  const skuPorId = new Map(skus.map((s) => [s.id, s]));

  const form = useForm<IngresoAlmacenInput>({
    resolver: zodResolver(ingresoAlmacenSchema),
    defaultValues: {
      fecha: fechaLocalHoy() as unknown as Date,
      ocNumero: "",
      guiaRemision: "",
      proveedorId: "",
      almacenId: almacenIdInicial ?? "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];

  const totalGeneral = items.reduce((acc, item) => acc + (Number(item?.cantidad) || 0) * (Number(item?.precioUnitario) || 0), 0);

  async function onSubmit(data: IngresoAlmacenInput) {
    let resultado;
    try {
      resultado = await crearIngresoAlmacenAction(data);
    } catch (err) {
      console.error("Error al guardar el ingreso a almacén:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Ingreso registrado");
    router.push(resultado?.id ? `/logistica/almacenes/ingresos/${resultado.id}` : "/logistica/almacenes/ingresos");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del ingreso</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Controller
              control={form.control}
              name="almacenId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un almacén" />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.almacenId && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.almacenId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Proveedor (opcional)</Label>
            <Controller
              control={form.control}
              name="proveedorId"
              render={({ field }) => (
                <Select
                  value={field.value || SIN_PROVEEDOR}
                  onValueChange={(valor) => field.onChange(valor === SIN_PROVEEDOR ? "" : valor)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_PROVEEDOR}>Sin proveedor</SelectItem>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.razonSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ocNumero">N° de OC (opcional)</Label>
            <Input id="ocNumero" {...form.register("ocNumero")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guiaRemision">Guía de remisión (opcional)</Label>
            <Input id="guiaRemision" {...form.register("guiaRemision")} />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Productos</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append(ITEM_VACIO)}>
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
                  <TableHead className="min-w-[220px]">Producto</TableHead>
                  <TableHead className="w-28">Cantidad</TableHead>
                  <TableHead className="w-20">U.M.</TableHead>
                  <TableHead className="w-32">Precio unitario</TableHead>
                  <TableHead className="w-32">Lote</TableHead>
                  <TableHead className="w-28 text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const subtotal = (Number(items[index]?.cantidad) || 0) * (Number(items[index]?.precioUnitario) || 0);
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="align-top">
                        <Input disabled value={skuPorId.get(items[index]?.skuId ?? "")?.codigo ?? ""} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Controller
                          control={form.control}
                          name={`items.${index}.skuId`}
                          render={({ field: selectField }) => (
                            <SkuCombobox
                              skus={skus}
                              value={selectField.value}
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
                        <Input type="number" min={0} step="0.001" {...form.register(`items.${index}.cantidad`)} />
                        {form.formState.errors.items?.[index]?.cantidad && (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            {form.formState.errors.items[index]?.cantidad?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input disabled {...form.register(`items.${index}.unidadMedida`)} />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          {...form.register(`items.${index}.precioUnitario`)}
                        />
                        {form.formState.errors.items?.[index]?.precioUnitario && (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            {form.formState.errors.items[index]?.precioUnitario?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input {...form.register(`items.${index}.lote`)} />
                      </TableCell>
                      <TableCell className="text-right align-top pt-4 font-medium">
                        {formatMoneda(subtotal)}
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

          <div className="flex justify-end border-t pt-4 text-base">
            Total: <span className="ml-2 font-semibold text-primary">{formatMoneda(totalGeneral)}</span>
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
