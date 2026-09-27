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
import { ProveedorRemitenteCombobox } from "@/components/shared/proveedor-remitente-combobox";
import { ProveedorSelectCombobox } from "@/components/shared/proveedor-select-combobox";
import { fechaLocalHoy, formatMoneda, prorratear } from "@/lib/utils";
import { MONEDAS, TIPO_CAMBIO_PEN_USD, convertirAUsd } from "@/lib/constants/moneda";
import { ingresoAlmacenSchema, type IngresoAlmacenInput } from "@/lib/validations/almacen";
import { crearIngresoAlmacenAction, actualizarIngresoAlmacenAction } from "@/lib/actions/ingreso-almacen-actions";

type Opcion = { id: string; nombre: string };
type ProveedorOpcion = { id: string; razonSocial: string; ruc: string };
type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string };

const ITEM_VACIO = { skuId: "", cantidad: 0, unidadMedida: "", precioUnitario: 0, lote: "" };

export function IngresoAlmacenForm({
  almacenes,
  proveedores,
  skus,
  almacenIdInicial,
  edicion,
}: {
  almacenes: Opcion[];
  proveedores: ProveedorOpcion[];
  skus: SkuOpcion[];
  almacenIdInicial?: string;
  /** Presente solo cuando el formulario edita un ingreso ya existente. */
  edicion?: { id: string; valoresIniciales: IngresoAlmacenInput };
}) {
  const router = useRouter();
  const skuPorId = new Map(skus.map((s) => [s.id, s]));

  const form = useForm<IngresoAlmacenInput>({
    resolver: zodResolver(ingresoAlmacenSchema),
    defaultValues: edicion?.valoresIniciales ?? {
      fecha: fechaLocalHoy() as unknown as Date,
      ocNumero: "",
      moneda: "PEN",
      guiaRemision: "",
      remitenteRuc: "",
      remitente: "",
      flete: 0,
      proveedorId: "",
      almacenId: almacenIdInicial ?? "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const flete = useWatch({ control: form.control, name: "flete" });
  const moneda = useWatch({ control: form.control, name: "moneda" }) ?? "PEN";
  const proveedorId = useWatch({ control: form.control, name: "proveedorId" });
  const rucProveedor = proveedores.find((p) => p.id === proveedorId)?.ruc ?? "";

  const subtotales = items.map((item) => (Number(item?.cantidad) || 0) * (Number(item?.precioUnitario) || 0));
  const fletePorItem = prorratear(Number(flete) || 0, subtotales);
  const totalSubtotal = subtotales.reduce((a, b) => a + b, 0);
  const totalGeneral = totalSubtotal + (Number(flete) || 0);
  const totalGeneralUsd = convertirAUsd(totalGeneral, moneda);

  async function onSubmit(data: IngresoAlmacenInput) {
    let resultado;
    try {
      resultado = edicion
        ? await actualizarIngresoAlmacenAction(edicion.id, data)
        : await crearIngresoAlmacenAction(data);
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
    if (edicion) {
      toast.success("Ingreso actualizado");
      router.push(`/logistica/almacenes/ingresos/${edicion.id}`);
    } else {
      toast.success("Ingreso registrado");
      router.push(resultado?.id ? `/logistica/almacenes/ingresos/${resultado.id}` : "/logistica/almacenes/ingresos");
    }
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
                <ProveedorSelectCombobox
                  proveedores={proveedores}
                  value={field.value ?? ""}
                  onSelect={(proveedor) => {
                    field.onChange(proveedor?.id ?? "");
                    if (proveedor) {
                      form.setValue("remitente", proveedor.razonSocial);
                      if (proveedor.ruc) form.setValue("remitenteRuc", proveedor.ruc);
                    }
                  }}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rucProveedor">RUC del proveedor</Label>
            <Input id="rucProveedor" disabled value={rucProveedor} placeholder="—" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ocNumero">N° de OC (opcional)</Label>
            <Input id="ocNumero" {...form.register("ocNumero")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guiaRemision">N° de guía de remisión (opcional)</Label>
            <Input id="guiaRemision" {...form.register("guiaRemision")} />
          </div>

          <div className="space-y-2">
            <Label>Moneda</Label>
            <Controller
              control={form.control}
              name="moneda"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEDAS.map((m) => (
                      <SelectItem key={m.codigo} value={m.codigo}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {moneda === "PEN" && (
              <p className="text-xs text-muted-foreground">
                Se convierte a Dólares con un tipo de cambio fijo de S/ {TIPO_CAMBIO_PEN_USD.toFixed(2)} para el
                costeo del stock.
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de transporte</CardTitle>
          <p className="text-sm text-muted-foreground">
            El flete se prorratea entre los productos según su participación en el subtotal, y se suma a su
            costo para el precio unitario ponderado del stock.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="remitenteRuc">RUC del remitente (opcional)</Label>
            <Input id="remitenteRuc" {...form.register("remitenteRuc")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remitente">Nombre del remitente (opcional)</Label>
            <Controller
              control={form.control}
              name="remitente"
              render={({ field }) => (
                <ProveedorRemitenteCombobox
                  proveedores={proveedores}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onSelect={(proveedor) => {
                    field.onChange(proveedor.razonSocial);
                    if (proveedor.ruc) form.setValue("remitenteRuc", proveedor.ruc);
                  }}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flete">Precio del flete (opcional)</Label>
            <Input id="flete" type="number" min={0} step="0.01" {...form.register("flete")} />
            {form.formState.errors.flete && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.flete.message}</p>
            )}
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
                  <TableHead className="w-28 text-right">Flete asignado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const subtotal = subtotales[index] ?? 0;
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
                        {formatMoneda(subtotal, moneda)}
                      </TableCell>
                      <TableCell className="text-right align-top pt-4 text-sm text-muted-foreground">
                        {formatMoneda(fletePorItem[index] ?? 0, moneda)}
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

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Subtotal productos: <span className="font-medium">{formatMoneda(totalSubtotal, moneda)}</span>
            </p>
            <p>
              Flete: <span className="font-medium">{formatMoneda(Number(flete) || 0, moneda)}</span>
            </p>
            <p className="text-base">
              Total: <span className="font-semibold text-primary">{formatMoneda(totalGeneral, moneda)}</span>
            </p>
            {moneda === "PEN" && (
              <p className="text-xs text-muted-foreground">≈ {formatMoneda(totalGeneralUsd, "USD")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando..." : edicion ? "Guardar cambios" : "Registrar ingreso"}
        </Button>
      </div>
    </form>
  );
}
