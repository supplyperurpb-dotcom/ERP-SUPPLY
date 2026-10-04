"use client";

import { useFieldArray, useForm, Controller } from "react-hook-form";
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
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { solicitudPedidoSchema, type SolicitudPedidoInput } from "@/lib/validations/compras";
import { crearSolicitudPedidoAction } from "@/lib/actions/solicitud-pedido-actions";

type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string };

const ITEM_VACIO = {
  skuId: "",
  cantidad: 0,
  unidadMedida: "",
  centroCosto: "PRODUCCION" as const,
  observaciones: "",
  descripcion: "",
};

export function SolicitudPedidoForm({
  skus,
  categoriaInicial = "COMPRA",
}: {
  skus: SkuOpcion[];
  categoriaInicial?: CategoriaCompraCodigo;
}) {
  const router = useRouter();
  const skuPorId = new Map(skus.map((s) => [s.id, s]));

  const form = useForm<SolicitudPedidoInput>({
    resolver: zodResolver(solicitudPedidoSchema),
    defaultValues: {
      categoria: categoriaInicial,
      area: "PRODUCCION",
      fecha: fechaLocalHoy() as unknown as Date,
      fechaNecesidad: fechaLocalHoy() as unknown as Date,
      tipoNecesidad: "ESTANDAR",
      justificacion: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  async function onSubmit(data: SolicitudPedidoInput) {
    let resultado;
    try {
      resultado = await crearSolicitudPedidoAction(data);
    } catch (err) {
      console.error("Error al guardar la solicitud de pedido:", err);
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
      window.open(`/api/pdf/solicitud-pedido/${resultado.id}`, "_blank");
      router.push(`/logistica/solicitudes-pedido/${resultado.id}`);
    } else {
      router.push("/logistica/solicitudes-pedido");
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
            <Label>Categoría</Label>
            <Select value={categoriaInicial} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_COMPRA.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Definida por el botón con el que entraste. Vuelve a la lista para crear la otra categoría.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <Controller
              control={form.control}
              name="area"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de pedido</Label>
            <Input id="fecha" type="date" {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fechaNecesidad">Fecha estimada de necesidad</Label>
            <Input id="fechaNecesidad" type="date" {...form.register("fechaNecesidad")} />
            {form.formState.errors.fechaNecesidad && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fechaNecesidad.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de necesidad</Label>
            <Controller
              control={form.control}
              name="tipoNecesidad"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_NECESIDAD.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="justificacion">Justificación / observación (opcional)</Label>
            <Textarea id="justificacion" rows={2} {...form.register("justificacion")} />
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
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  {categoriaInicial === "SERVICIO" && (
                    <TableHead className="min-w-[220px]">Descripción del servicio</TableHead>
                  )}
                  <TableHead className="w-28">Cantidad</TableHead>
                  <TableHead className="w-20">U.M.</TableHead>
                  <TableHead className="w-44">Centro de costo</TableHead>
                  <TableHead className="min-w-[180px]">Observación</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const skuIdActual = form.watch(`items.${index}.skuId`);
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="align-top">
                        <Input disabled value={skuPorId.get(skuIdActual ?? "")?.codigo ?? ""} />
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
                      {categoriaInicial === "SERVICIO" && (
                        <TableCell className="align-top">
                          <Textarea
                            rows={2}
                            placeholder="Ej. Cambio de cableado en tablero 3"
                            {...form.register(`items.${index}.descripcion`)}
                          />
                          {form.formState.errors.items?.[index]?.descripcion && (
                            <p className="mt-1 text-xs font-medium text-destructive">
                              {form.formState.errors.items[index]?.descripcion?.message}
                            </p>
                          )}
                        </TableCell>
                      )}
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
                        <Controller
                          control={form.control}
                          name={`items.${index}.centroCosto`}
                          render={({ field: selectField }) => (
                            <Select value={selectField.value} onValueChange={selectField.onChange}>
                              <SelectTrigger>
                                <SelectValue />
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
                      </TableCell>
                      <TableCell className="align-top">
                        <Input {...form.register(`items.${index}.observaciones`)} />
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
