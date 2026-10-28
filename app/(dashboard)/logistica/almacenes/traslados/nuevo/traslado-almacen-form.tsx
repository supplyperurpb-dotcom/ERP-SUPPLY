"use client";

import { useState } from "react";
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
import { trasladoAlmacenSchema, type TrasladoAlmacenInput } from "@/lib/validations/almacen";
import {
  crearTrasladoAlmacenAction,
  actualizarTrasladoAlmacenAction,
  subirGuiaRemisionTrasladoAction,
} from "@/lib/actions/traslado-almacen-actions";
import type { FilaStockAlmacen, LoteStock } from "@/lib/stock-almacen";

type Opcion = { id: string; nombre: string; categoriaGeneral: string | null };

const ITEM_VACIO = { skuId: "", cantidad: 0, unidadMedida: "", lote: "", fechaProduccion: undefined, fechaVencimiento: undefined };

function soloFecha(d: Date | string | undefined): string {
  if (!d) return "";
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

export function TrasladoAlmacenForm({
  almacenes,
  stockPorAlmacen,
  lotesPorAlmacen,
  almacenOrigenIdInicial,
  edicion,
}: {
  almacenes: Opcion[];
  stockPorAlmacen: Record<string, FilaStockAlmacen[]>;
  /** Solo trae datos para almacenes de origen de categoría PESTICIDAS o FERTILIZANTES. */
  lotesPorAlmacen: Record<string, Record<string, LoteStock[]>>;
  almacenOrigenIdInicial?: string;
  /** Presente solo cuando el formulario edita un traslado ya existente.
   * `stockPorAlmacen` ya viene ajustado por la página para el almacén de
   * origen original (ver traslados/[id]/editar/page.tsx): incluye de
   * vuelta lo que este mismo traslado le había restado, como si ya
   * estuviera reversado (que es justo lo que hace el servidor al guardar).
   * `fechaRegistro` es solo informativa (cuándo se creó el registro,
   * Prisma.createdAt): en un traslado nuevo es hoy, bloqueada. */
  edicion?: { id: string; fechaRegistro: string; valoresIniciales: TrasladoAlmacenInput };
}) {
  const router = useRouter();
  const fechaRegistro = edicion?.fechaRegistro ?? fechaLocalHoy();
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const form = useForm<TrasladoAlmacenInput>({
    resolver: zodResolver(trasladoAlmacenSchema),
    defaultValues: edicion?.valoresIniciales ?? {
      fecha: fechaLocalHoy() as unknown as Date,
      almacenOrigenId: almacenOrigenIdInicial ?? "",
      almacenDestinoId: "",
      guiaRemision: "",
      guiaRemisionArchivo: "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const almacenOrigenId = useWatch({ control: form.control, name: "almacenOrigenId" });
  const archivoActual = edicion?.valoresIniciales.guiaRemisionArchivo;

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
  const stockPorSkuId = new Map(stockOrigen.map((s) => [s.skuId, s]));

  function stockDisponibleDe(skuId: string) {
    return stockPorSkuId.get(skuId)?.cantidad ?? 0;
  }

  // Agroquímicos y Fertilizantes exige elegir de qué lote sale cada
  // producto — igual que al ingresar o consumir — y la cantidad a
  // trasladar no puede superar lo que queda de ESE lote puntual, no solo
  // el total del SKU en el almacén.
  const almacenOrigenActual = almacenes.find((a) => a.id === almacenOrigenId);
  const muestraLote =
    almacenOrigenActual?.categoriaGeneral === "PESTICIDAS" || almacenOrigenActual?.categoriaGeneral === "FERTILIZANTES";

  // El destino solo puede ser de la misma categoría que el origen (ver
  // validarCategoriasSiAplica en traslado-almacen-actions.ts) — acá se
  // filtra la lista para que ni se pueda elegir uno distinto.
  const almacenesDestino = almacenOrigenId
    ? almacenes.filter((a) => a.id !== almacenOrigenId && a.categoriaGeneral === almacenOrigenActual?.categoriaGeneral)
    : almacenes;

  function lotesDe(skuId: string): LoteStock[] {
    if (!muestraLote || !almacenOrigenId || !skuId) return [];
    return lotesPorAlmacen[almacenOrigenId]?.[skuId] ?? [];
  }

  function stockDisponibleEfectivo(skuId: string, lote: string) {
    if (!muestraLote) return stockDisponibleDe(skuId);
    return lotesDe(skuId).find((l) => l.lote === lote)?.cantidad ?? 0;
  }

  async function handleSubmitConArchivo(e: React.FormEvent) {
    e.preventDefault();
    if (!archivoFile && !archivoActual) {
      toast.error("Adjunta la guía de remisión (foto o PDF)");
      return;
    }

    if (archivoFile) {
      setSubiendoArchivo(true);
      try {
        const fd = new FormData();
        fd.set("archivo", archivoFile);
        const resultado = await subirGuiaRemisionTrasladoAction(fd);
        if (resultado.error || !resultado.path) {
          toast.error(resultado.error ?? "No se pudo subir la guía de remisión");
          return;
        }
        form.setValue("guiaRemisionArchivo", resultado.path, { shouldValidate: true });
      } finally {
        setSubiendoArchivo(false);
      }
    }

    await form.handleSubmit(onSubmit)();
  }

  async function onSubmit(data: TrasladoAlmacenInput) {
    const excedeAlgunaLinea = data.items.some(
      (item) => item.cantidad > stockDisponibleEfectivo(item.skuId, item.lote ?? "")
    );
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible en el almacén de origen. Corrígelo antes de guardar.");
      return;
    }
    if (muestraLote && data.items.some((item) => !item.lote?.trim() || !item.fechaProduccion || !item.fechaVencimiento)) {
      toast.error("Selecciona el lote de cada producto en este almacén (exige lote, fecha de producción y vencimiento).");
      return;
    }

    let resultado;
    try {
      resultado = edicion
        ? await actualizarTrasladoAlmacenAction(edicion.id, data)
        : await crearTrasladoAlmacenAction(data);
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
    if (edicion) {
      toast.success("Traslado actualizado");
      router.push(`/logistica/almacenes/traslados/${edicion.id}`);
      return;
    }
    toast.success("Traslado registrado");
    router.push(resultado?.id ? `/logistica/almacenes/traslados/${resultado.id}` : "/logistica/almacenes/traslados");
  }

  return (
    <form onSubmit={handleSubmitConArchivo} className="space-y-6">
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
                    // El destino elegido puede ya no ser de la misma
                    // categoría que el nuevo origen: se limpia también.
                    const nuevaCategoria = almacenes.find((a) => a.id === valor)?.categoriaGeneral;
                    const destinoActual = form.getValues("almacenDestinoId");
                    if (destinoActual && almacenes.find((a) => a.id === destinoActual)?.categoriaGeneral !== nuevaCategoria) {
                      form.setValue("almacenDestinoId", "");
                    }
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
                <Select value={field.value} onValueChange={field.onChange} disabled={!almacenOrigenId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={almacenOrigenId ? "Selecciona un almacén" : "Primero elige el almacén de origen"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenesDestino.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No hay otro almacén de esta categoría
                      </div>
                    ) : (
                      almacenesDestino.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nombre}
                        </SelectItem>
                      ))
                    )}
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
            <Label htmlFor="fechaRegistro">Fecha de registro</Label>
            <Input
              id="fechaRegistro"
              type="date"
              readOnly
              className="cursor-not-allowed bg-muted opacity-70"
              value={fechaRegistro}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guiaRemision">N° de guía de remisión</Label>
            <Input id="guiaRemision" {...form.register("guiaRemision")} />
            {form.formState.errors.guiaRemision && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.guiaRemision.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="archivoGuia">
              {edicion ? "Reemplazar guía de remisión (foto, escaneo o PDF)" : "Guía de remisión (foto, escaneo o PDF)"}
            </Label>
            <div className="flex items-center gap-3">
              {archivoActual && !archivoFile && edicion && (
                <a
                  href={`/api/almacenes/traslados/${edicion.id}/guia`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Ver archivo actual
                </a>
              )}
              <Input
                id="archivoGuia"
                type="file"
                accept="application/pdf,image/*"
                capture="environment"
                onChange={(e) => setArchivoFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {archivoFile && <p className="text-xs text-muted-foreground">Seleccionado: {archivoFile.name}</p>}
            {form.formState.errors.guiaRemisionArchivo && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.guiaRemisionArchivo.message}</p>
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
                    {muestraLote && (
                      <>
                        <TableHead className="w-48">Lote *</TableHead>
                        <TableHead className="w-32">F. producción</TableHead>
                        <TableHead className="w-32">F. vencimiento</TableHead>
                      </>
                    )}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const skuId = items[index]?.skuId ?? "";
                    const loteElegido = items[index]?.lote ?? "";
                    const lotesSku = lotesDe(skuId);
                    const disponible = stockDisponibleEfectivo(skuId, loteElegido);
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
                                  // Los lotes dependen del producto: se limpian al cambiarlo.
                                  form.setValue(`items.${index}.lote`, "");
                                  form.setValue(`items.${index}.fechaProduccion`, undefined);
                                  form.setValue(`items.${index}.fechaVencimiento`, undefined);
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
                              La cantidad excede el stock disponible ({formatCantidad(disponible)}).
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                          {items[index]?.unidadMedida || "—"}
                        </TableCell>
                        <TableCell className="align-top pt-4 text-sm">{skuId ? formatCantidad(disponible) : "—"}</TableCell>
                        {muestraLote && (
                          <>
                            <TableCell className="align-top">
                              <Controller
                                control={form.control}
                                name={`items.${index}.lote`}
                                render={({ field: loteField }) => (
                                  <Select
                                    value={loteField.value || ""}
                                    onValueChange={(valor) => {
                                      loteField.onChange(valor);
                                      const lote = lotesSku.find((l) => l.lote === valor);
                                      form.setValue(
                                        `items.${index}.fechaProduccion`,
                                        lote?.fechaProduccion ? (soloFecha(lote.fechaProduccion) as unknown as Date) : undefined
                                      );
                                      form.setValue(
                                        `items.${index}.fechaVencimiento`,
                                        lote?.fechaVencimiento ? (soloFecha(lote.fechaVencimiento) as unknown as Date) : undefined
                                      );
                                    }}
                                    disabled={!skuId}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona un lote" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {lotesSku.length === 0 ? (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">Sin lotes con stock</div>
                                      ) : (
                                        lotesSku.map((l) => (
                                          <SelectItem key={l.lote} value={l.lote}>
                                            {l.lote} — {formatCantidad(l.cantidad)} {l.unidadMedida}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </TableCell>
                            <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                              {soloFecha(items[index]?.fechaProduccion as unknown as string) || "—"}
                            </TableCell>
                            <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                              {soloFecha(items[index]?.fechaVencimiento as unknown as string) || "—"}
                            </TableCell>
                          </>
                        )}
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
        <Button type="submit" disabled={form.formState.isSubmitting || subiendoArchivo}>
          {subiendoArchivo
            ? "Subiendo archivo..."
            : form.formState.isSubmitting
              ? "Guardando..."
              : edicion
                ? "Guardar cambios"
                : "Registrar traslado"}
        </Button>
      </div>
    </form>
  );
}
