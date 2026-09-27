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
import { fechaLocalHoy } from "@/lib/utils";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";
import { crearConsumoAlmacenAction } from "@/lib/actions/consumo-almacen-actions";

type Opcion = { id: string; nombre: string };
type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string };

const ITEM_VACIO = { skuId: "", cantidad: 0, unidadMedida: "" };

export function ConsumoAlmacenForm({
  almacenes,
  skus,
  almacenIdInicial,
}: {
  almacenes: Opcion[];
  skus: SkuOpcion[];
  almacenIdInicial?: string;
}) {
  const router = useRouter();
  const skuPorId = new Map(skus.map((s) => [s.id, s]));

  const form = useForm<ConsumoAlmacenInput>({
    resolver: zodResolver(consumoAlmacenSchema),
    defaultValues: {
      fecha: fechaLocalHoy() as unknown as Date,
      almacenOrigenId: almacenIdInicial ?? "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];

  async function onSubmit(data: ConsumoAlmacenInput) {
    let resultado;
    try {
      resultado = await crearConsumoAlmacenAction(data);
    } catch (err) {
      console.error("Error al guardar el consumo:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Consumo registrado");
    router.push(resultado?.id ? `/logistica/almacenes/consumos/${resultado.id}` : "/logistica/almacenes/consumos");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del consumo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén de origen</Label>
            <Controller
              control={form.control}
              name="almacenOrigenId"
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
            {form.formState.errors.almacenOrigenId && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.almacenOrigenId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
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
            <CardTitle className="text-base">Productos</CardTitle>
            <p className="text-sm text-muted-foreground">
              El precio unitario ponderado y el valor consumido se calculan automáticamente al guardar, según
              el promedio de los ingresos históricos de cada producto en este almacén.
            </p>
          </div>
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
                  <TableHead className="min-w-[260px]">Producto</TableHead>
                  <TableHead className="w-28">Cantidad</TableHead>
                  <TableHead className="w-20">U.M.</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
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
                    <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                      {items[index]?.unidadMedida || "—"}
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
                ))}
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
          {form.formState.isSubmitting ? "Guardando..." : "Registrar consumo"}
        </Button>
      </div>
    </form>
  );
}
