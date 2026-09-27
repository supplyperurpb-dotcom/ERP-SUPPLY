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
import { trasladoAlmacenSchema, type TrasladoAlmacenInput } from "@/lib/validations/almacen";
import { crearTrasladoAlmacenAction } from "@/lib/actions/traslado-almacen-actions";
import type { FilaStockAlmacen } from "@/lib/stock-almacen";

type Opcion = { id: string; nombre: string };

const ITEM_VACIO = { skuId: "", cantidad: 0, unidadMedida: "" };

export function TrasladoAlmacenForm({
  almacenes,
  stockPorAlmacen,
  almacenOrigenIdInicial,
}: {
  almacenes: Opcion[];
  stockPorAlmacen: Record<string, FilaStockAlmacen[]>;
  almacenOrigenIdInicial?: string;
}) {
  const router = useRouter();

  const form = useForm<TrasladoAlmacenInput>({
    resolver: zodResolver(trasladoAlmacenSchema),
    defaultValues: {
      fecha: fechaLocalHoy() as unknown as Date,
      almacenOrigenId: almacenOrigenIdInicial ?? "",
      almacenDestinoId: "",
      guiaRemision: "",
      remitente: "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const almacenOrigenId = useWatch({ control: form.control, name: "almacenOrigenId" });

  // Solo se puede trasladar lo que el almacén de origen realmente tiene en
  // stock: el combobox de producto se restringe a esa lista, y sirve
  // también para mostrar/validar la cantidad disponible por línea.
  const stockOrigen = almacenOrigenId ? stockPorAlmacen[almacenOrigenId] ?? [] : [];
  const skusDisponibles = stockOrigen.map((s) => ({
    id: s.skuId,
    codigo: s.codigo,
    descripcion: s.descripcion,
    unidadMedida: s.unidadMedida,
  }));
  const stockPorSkuId = new Map(stockOrigen.map((s) => [s.skuId, s.cantidad]));

  function stockDisponibleDe(skuId: string) {
    return stockPorSkuId.get(skuId) ?? 0;
  }

  async function onSubmit(data: TrasladoAlmacenInput) {
    const excedeAlgunaLinea = data.items.some((item) => item.cantidad > stockDisponibleDe(item.skuId));
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible en el almacén de origen. Corrígelo antes de guardar.");
      return;
    }

    let resultado;
    try {
      resultado = await crearTrasladoAlmacenAction(data);
    } catch (err) {
      console.error("Error al guardar el traslado:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Traslado registrado");
    router.push(resultado?.id ? `/logistica/almacenes/traslados/${resultado.id}` : "/logistica/almacenes/traslados");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del traslado</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén de origen</Label>
            <Controller
              control={form.control}
              name="almacenOrigenId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(valor) => {
                    field.onChange(valor);
                    // Los productos de las líneas ya cargadas pueden no
                    // tener stock en el nuevo origen: se limpian.
                    replace([ITEM_VACIO]);
                  }}
                >
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
            <Label>Almacén de destino</Label>
            <Controller
              control={form.control}
              name="almacenDestinoId"
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
            {form.formState.errors.almacenDestinoId && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.almacenDestinoId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de traslado</Label>
            <Input id="fecha" type="date" {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guiaRemision">Guía de remisión (opcional)</Label>
            <Input id="guiaRemision" {...form.register("guiaRemision")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remitente">Remitente de la guía (opcional)</Label>
            <Input id="remitente" {...form.register("remitente")} />
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
              Solo aparecen productos con stock disponible en el almacén de origen elegido.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!almacenOrigenId}
            onClick={() => append(ITEM_VACIO)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!almacenOrigenId ? (
            <p className="text-sm text-muted-foreground">Selecciona primero el almacén de origen.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-[260px]">Producto</TableHead>
                    <TableHead className="w-28">Cantidad</TableHead>
                    <TableHead className="w-20">U.M.</TableHead>
                    <TableHead className="w-28">Stock disponible</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const skuId = items[index]?.skuId ?? "";
                    const disponible = stockDisponibleDe(skuId);
                    const cantidad = Number(items[index]?.cantidad) || 0;
                    const excede = skuId !== "" && cantidad > disponible;
                    return (
                      <TableRow key={field.id}>
                        <TableCell className="align-top">
                          <Input disabled value={stockOrigen.find((s) => s.skuId === skuId)?.codigo ?? ""} />
                        </TableCell>
                        <TableCell className="align-top">
                          <Controller
                            control={form.control}
                            name={`items.${index}.skuId`}
                            render={({ field: selectField }) => (
                              <SkuCombobox
                                skus={skusDisponibles}
                                value={selectField.value}
                                emptyMessage="Este almacén no tiene productos con stock disponible."
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
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            className={excede ? "border-destructive focus-visible:ring-destructive" : undefined}
                            {...form.register(`items.${index}.cantidad`)}
                          />
                          {form.formState.errors.items?.[index]?.cantidad && (
                            <p className="mt-1 text-xs font-medium text-destructive">
                              {form.formState.errors.items[index]?.cantidad?.message}
                            </p>
                          )}
                          {excede && (
                            <p className="mt-1 text-xs font-medium text-destructive">
                              La cantidad excede el stock disponible ({disponible}).
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                          {items[index]?.unidadMedida || "—"}
                        </TableCell>
                        <TableCell className="align-top pt-4 text-sm">{skuId ? disponible : "—"}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando..." : "Registrar traslado"}
        </Button>
      </div>
    </form>
  );
}
