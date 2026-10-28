"use client";

import { useState } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
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
import { fechaLocalHoy, fechaLocalEnDias } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA, type CategoriaCompraCodigo, type AreaEmpresaCodigo } from "@/lib/constants/compras";
import { solicitudPedidoSchema, type SolicitudPedidoInput } from "@/lib/validations/compras";
import { crearSolicitudPedidoAction, editarSolicitudPedidoAction } from "@/lib/actions/solicitud-pedido-actions";

type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string };

type ItemInicial = {
  id?: string;
  skuId: string;
  cantidad: number;
  unidadMedida: string;
  centroCosto: string;
  descripcion: string;
  campo: string;
};

function itemVacio(centroCostoInicial: string) {
  return {
    skuId: "",
    cantidad: 0,
    unidadMedida: "",
    centroCosto: centroCostoInicial,
    descripcion: "",
    campo: "",
  };
}

export function SolicitudPedidoForm({
  skus,
  categoriaInicial = "COMPRA",
  areaInicial = "PRODUCCION",
  areaEditable = true,
  centrosCosto,
  campos,
  // Modo edición: solicitudId + valoresIniciales precargan el formulario y
  // el submit llama a editarSolicitudPedidoAction en vez de crear una
  // nueva. itemsNoEliminables son líneas con historial de OC/OS (aunque
  // esté anulada) — el botón de quitar se deshabilita para esas, porque el
  // server las rechazaría igual (ver editarSolicitudPedidoAction).
  solicitudId,
  valoresIniciales,
  itemsNoEliminables,
  advertenciaReinicioAprobacion,
}: {
  skus: SkuOpcion[];
  categoriaInicial?: CategoriaCompraCodigo;
  areaInicial?: AreaEmpresaCodigo;
  areaEditable?: boolean;
  centrosCosto: string[];
  campos: string[];
  solicitudId?: string;
  valoresIniciales?: {
    fecha: string;
    fechaNecesidad: string;
    tipoNecesidad: SolicitudPedidoInput["tipoNecesidad"];
    justificacion: string;
    items: ItemInicial[];
  };
  itemsNoEliminables?: Set<string>;
  /** Esta solicitud ya estaba aprobada: guardar la vuelve a "Borrador" y exige una nueva aprobación completa. */
  advertenciaReinicioAprobacion?: boolean;
}) {
  const router = useRouter();
  const modoEdicion = !!solicitudId && !!valoresIniciales;
  const skuPorId = new Map(skus.map((s) => [s.id, s]));
  const centroCostoInicial = centrosCosto[0] ?? "";

  const form = useForm<SolicitudPedidoInput>({
    resolver: zodResolver(solicitudPedidoSchema),
    defaultValues: valoresIniciales
      ? {
          categoria: categoriaInicial,
          area: areaInicial,
          fecha: valoresIniciales.fecha as unknown as Date,
          fechaNecesidad: valoresIniciales.fechaNecesidad as unknown as Date,
          tipoNecesidad: valoresIniciales.tipoNecesidad,
          justificacion: valoresIniciales.justificacion,
          items: valoresIniciales.items,
        }
      : {
          categoria: categoriaInicial,
          area: areaInicial,
          fecha: fechaLocalHoy() as unknown as Date,
          // Sugerida a una semana vista — el usuario debe hacer clic en el
          // campo (confirmarla o cambiarla) antes de poder guardar, ver
          // fechaNecesidadConfirmada más abajo.
          fechaNecesidad: fechaLocalEnDias(7) as unknown as Date,
          tipoNecesidad: "ESTANDAR",
          justificacion: "",
          items: [itemVacio(centroCostoInicial)],
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  // La fecha estimada de necesidad sale precargada a una semana vista, pero
  // no se puede guardar hasta que el usuario haga clic en el campo y
  // confirme esa fecha (o elija otra) — evita que quede sin revisar. Al
  // editar, el valor ya es el real (no una sugerencia), así que no hace
  // falta forzar el reclic.
  const [fechaNecesidadConfirmada, setFechaNecesidadConfirmada] = useState(modoEdicion);

  async function onSubmit(data: SolicitudPedidoInput) {
    if (!fechaNecesidadConfirmada) {
      form.setError("fechaNecesidad", {
        type: "manual",
        message: "Haz clic en la fecha estimada de necesidad para confirmarla (o elige otra) antes de guardar.",
      });
      return;
    }
    let resultado;
    try {
      resultado =
        modoEdicion && solicitudId ? await editarSolicitudPedidoAction(solicitudId, data) : await crearSolicitudPedidoAction(data);
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
    toast.success(modoEdicion ? "Solicitud actualizada" : "Solicitud registrada");
    if (resultado?.id) {
      if (!modoEdicion) window.open(`/api/pdf/solicitud-pedido/${resultado.id}`, "_blank");
      router.push(`/logistica/solicitudes-pedido/${resultado.id}`);
    } else {
      router.push("/logistica/solicitudes-pedido");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {advertenciaReinicioAprobacion && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Esta solicitud ya estaba aprobada. Al guardar los cambios, vuelve a quedar en estado{" "}
          <span className="font-medium">Borrador</span> y debe pasar de nuevo por toda la aprobación.
        </p>
      )}
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
                <Select value={field.value} onValueChange={field.onChange} disabled={!areaEditable}>
                  <SelectTrigger className={!areaEditable ? "cursor-not-allowed bg-muted opacity-70" : undefined}>
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
            {!areaEditable && (
              <p className="text-xs text-muted-foreground">Fijada según tu área asignada.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de pedido</Label>
            <Input
              id="fecha"
              type="date"
              readOnly
              className="cursor-not-allowed bg-muted opacity-70"
              {...form.register("fecha")}
            />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-700">Reconfirmar fecha</p>
            <Label htmlFor="fechaNecesidad">Fecha estimada de necesidad</Label>
            <Input
              id="fechaNecesidad"
              type="date"
              min={fechaLocalHoy()}
              {...form.register("fechaNecesidad", {
                // El navegador no dispara onChange si el usuario reabre el
                // selector y elige la MISMA fecha ya sugerida (no hay
                // cambio de valor que detectar) — por eso también se
                // confirma con onBlur: alcanza con que haya entrado al
                // campo y salido, haya cambiado la fecha o no.
                onChange: () => {
                  setFechaNecesidadConfirmada(true);
                  form.clearErrors("fechaNecesidad");
                },
                onBlur: () => {
                  setFechaNecesidadConfirmada(true);
                  form.clearErrors("fechaNecesidad");
                },
              })}
            />
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
            <Label htmlFor="justificacion">Justificación / observación</Label>
            <Textarea id="justificacion" rows={2} {...form.register("justificacion")} />
            {form.formState.errors.justificacion && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.justificacion.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Productos</CardTitle>
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
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  {categoriaInicial === "SERVICIO" && (
                    <TableHead className="min-w-[220px]">Descripción del servicio</TableHead>
                  )}
                  <TableHead className="w-28">Cantidad</TableHead>
                  <TableHead className="w-20">U.M.</TableHead>
                  <TableHead className="w-44">Centro de costo</TableHead>
                  <TableHead className="w-40">Campo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const skuIdActual = form.watch(`items.${index}.skuId`);
                  const itemIdActual = form.watch(`items.${index}.id`);
                  const noEliminable = !!itemIdActual && !!itemsNoEliminables?.has(itemIdActual);
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="align-top">
                        <input type="hidden" {...form.register(`items.${index}.id`)} />
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
                        <Controller
                          control={form.control}
                          name={`items.${index}.cantidad`}
                          render={({ field: cantidadField }) => (
                            <NumberInput value={String(cantidadField.value ?? "")} onChange={cantidadField.onChange} />
                          )}
                        />
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
                                {centrosCosto.map((c) => (
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
                        <Controller
                          control={form.control}
                          name={`items.${index}.campo`}
                          render={({ field: selectField }) => (
                            <Select value={selectField.value || "__ninguno__"} onValueChange={(v) => selectField.onChange(v === "__ninguno__" ? "" : v)}>
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
                          disabled={fields.length === 1 || noEliminable}
                          title={noEliminable ? "Ya tiene una orden de compra/servicio generada (aunque esté anulada); no se puede quitar." : undefined}
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
          {form.formState.isSubmitting ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Registrar solicitud"}
        </Button>
      </div>
    </form>
  );
}
