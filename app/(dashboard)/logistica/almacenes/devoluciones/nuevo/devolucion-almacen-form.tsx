"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkuCombobox } from "@/components/shared/sku-combobox";
import { RetiradorAutorizadoCombobox } from "@/components/shared/retirador-autorizado-combobox";
import { fechaLocalHoy, formatMoneda, horaLocalAhora } from "@/lib/utils";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { categoriaAlmacenExigidaPorSku } from "@/lib/constants/sku";
import { devolucionAlmacenSchema, type DevolucionAlmacenInput } from "@/lib/validations/devolucion-almacen";
import {
  crearDevolucionAlmacenAction,
  actualizarDevolucionAlmacenAction,
  obtenerPrecioPonderadoAction,
} from "@/lib/actions/devolucion-almacen-actions";

type AlmacenOpcion = { id: string; codigo: string; nombre: string; categoriaGeneral: string | null };
type RetiradorOpcion = { id: string; nombreCompleto: string; dni: string; area: string; almacenesIds: string[] };
type SkuOpcion = { id: string; codigo: string; descripcion: string; subfamilia: string; unidadMedida: string; requiereLote: boolean };

const ITEM_VACIO = {
  skuId: "",
  cantidad: 0,
  unidadMedida: "",
  noValorado: false,
  lote: "",
  fechaProduccion: undefined,
  fechaVencimiento: undefined,
};

export function DevolucionAlmacenForm({
  usuario,
  almacenes,
  retiradores,
  skus,
  almacenIdInicial,
  edicion,
}: {
  usuario: { nombres: string; apellidos: string };
  almacenes: AlmacenOpcion[];
  retiradores: RetiradorOpcion[];
  skus: SkuOpcion[];
  almacenIdInicial?: string;
  /** Presente solo cuando el formulario edita una devolución ya existente. */
  edicion?: { id: string; valoresIniciales: DevolucionAlmacenInput };
}) {
  const router = useRouter();
  const fecha = edicion?.valoresIniciales.fecha ?? (fechaLocalHoy() as unknown as Date);
  const hora = edicion?.valoresIniciales.hora ?? horaLocalAhora();
  const [preciosPorFila, setPreciosPorFila] = useState<Record<number, number | null>>({});

  const form = useForm<DevolucionAlmacenInput>({
    resolver: zodResolver(devolucionAlmacenSchema),
    defaultValues: edicion?.valoresIniciales ?? {
      fecha: fechaLocalHoy() as unknown as Date,
      hora,
      almacenId: almacenIdInicial ?? "",
      area: undefined,
      personaQueTrae: "",
      personaQueTraeDni: "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const almacenId = useWatch({ control: form.control, name: "almacenId" });
  const personaQueTraeDni = useWatch({ control: form.control, name: "personaQueTraeDni" });
  const area = useWatch({ control: form.control, name: "area" });

  const almacenActual = almacenes.find((a) => a.id === almacenId);
  const requierePorAlmacen =
    almacenActual?.categoriaGeneral === "PESTICIDAS" || almacenActual?.categoriaGeneral === "FERTILIZANTES";
  // Igual que en Ingreso: además del almacén, un SKU puntual puede exigir
  // lote/fechas aunque el almacén no sea de Pesticidas/Fertilizantes (ver
  // Sku.requiereLote).
  const muestraLote =
    requierePorAlmacen || items.some((it) => skus.find((s) => s.id === it.skuId)?.requiereLote);

  // Solo se puede elegir a alguien con permiso de retirar (y devolver) a
  // ESTE almacén — ver Listas > Retiradores autorizados.
  const retiradoresDisponibles = almacenId ? retiradores.filter((r) => r.almacenesIds.includes(almacenId)) : [];
  const retiradorSeleccionadoId = retiradoresDisponibles.find((r) => r.dni === personaQueTraeDni)?.id ?? "";

  // El combobox de producto solo ofrece los SKU de la categoría que le
  // corresponde al almacén elegido (ver categoriaAlmacenExigidaPorSku) —
  // nunca se deja armar una línea que el servidor va a rechazar igual.
  const skusDelAlmacen = almacenActual
    ? skus.filter((s) => {
        const categoriaExigida = categoriaAlmacenExigidaPorSku(s);
        return !categoriaExigida || categoriaExigida === almacenActual.categoriaGeneral;
      })
    : [];

  // Trae el costo unitario ponderado del SKU en el almacén elegido TAL
  // COMO ERA en `fecha` (la fecha de la devolución), solo como vista
  // previa — el servidor lo vuelve a calcular al guardar (ver
  // crearDevolucionAlmacenAction) y nunca confía en este valor.
  async function cargarPrecio(index: number, skuId: string) {
    if (!almacenId || !skuId) return;
    const precio = await obtenerPrecioPonderadoAction(almacenId, skuId, fecha);
    setPreciosPorFila((prev) => ({ ...prev, [index]: precio }));
  }

  function precioEfectivo(index: number, noValorado: boolean): number | null {
    if (noValorado) return 0;
    return preciosPorFila[index] ?? null;
  }

  // Al editar, las líneas ya traen su skuId precargado: se busca su costo
  // ponderado actual (puede haber cambiado desde que se registró) para que
  // la vista previa no quede en blanco hasta que el usuario toque la fila.
  useEffect(() => {
    if (!edicion || !almacenId) return;
    edicion.valoresIniciales.items.forEach((item, index) => {
      if (item.skuId) cargarPrecio(index, item.skuId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion?.id]);

  const subtotales = items.map((it, i) => (precioEfectivo(i, !!it.noValorado) ?? 0) * (Number(it.cantidad) || 0));
  const total = subtotales.reduce((a, b) => a + b, 0);

  async function onSubmit(data: DevolucionAlmacenInput) {
    const faltaPrecio = data.items.some((it, i) => !it.noValorado && precioEfectivo(i, false) === null);
    if (faltaPrecio) {
      toast.error("Hay productos sin costo ponderado calculable en este almacén. Márcalos como 'No valorado' o corrige la línea.");
      return;
    }

    let resultado;
    try {
      resultado = edicion
        ? await actualizarDevolucionAlmacenAction(edicion.id, data)
        : await crearDevolucionAlmacenAction(data);
    } catch (err) {
      console.error("Error al guardar la devolución:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    if (edicion) {
      toast.success("Devolución actualizada");
      router.push(`/logistica/almacenes/devoluciones/${edicion.id}`);
      return;
    }
    toast.success("Devolución registrada");
    router.push(resultado?.id ? `/logistica/almacenes/devoluciones/${resultado.id}` : "/logistica/almacenes/devoluciones");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la devolución</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Controller
              control={form.control}
              name="almacenId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(valor) => {
                    field.onChange(valor);
                    replace([ITEM_VACIO]);
                    setPreciosPorFila({});
                    form.setValue("personaQueTrae", "");
                    form.setValue("personaQueTraeDni", "");
                    form.resetField("area");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un almacén" />
                  </SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-mono text-muted-foreground">{a.codigo}</span> — {a.nombre}
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
            <Label htmlFor="fecha">Fecha de registro</Label>
            <Input
              id="fecha"
              type="date"
              readOnly
              className="cursor-not-allowed bg-muted opacity-70"
              value={fecha as unknown as string}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hora">Hora</Label>
            <Input id="hora" type="time" readOnly className="cursor-not-allowed bg-muted opacity-70" value={hora} />
          </div>

          <div className="space-y-2">
            <Label>Usuario Registro</Label>
            <Input disabled className="cursor-not-allowed bg-muted opacity-70" value={`${usuario.nombres} ${usuario.apellidos}`} />
          </div>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <RetiradorAutorizadoCombobox
              retiradores={retiradoresDisponibles}
              value={retiradorSeleccionadoId}
              disabled={!almacenId}
              mensajeDeshabilitado="Selecciona primero el almacén."
              mensajeVacio="Nadie tiene permiso en este almacén. Agrégalo en Listas > Retiradores autorizados."
              onSelect={(r) => {
                // El DNI y el área quedan fijados por el retirador elegido
                // (ver RetiradorAutorizado.area) — ya no se eligen a mano,
                // para que no puedan quedar desincronizados del registro de
                // Listas > Retiradores autorizados.
                const retirador = retiradoresDisponibles.find((x) => x.id === r.id);
                form.setValue("personaQueTrae", r.nombreCompleto, { shouldValidate: true });
                form.setValue("personaQueTraeDni", r.dni, { shouldValidate: true });
                if (retirador) {
                  form.setValue("area", retirador.area as DevolucionAlmacenInput["area"], { shouldValidate: true });
                }
              }}
            />
            {form.formState.errors.personaQueTrae && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.personaQueTrae.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="personaQueTraeDni">DNI</Label>
            <Input id="personaQueTraeDni" disabled value={personaQueTraeDni || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Área que devuelve</Label>
            <Input id="area" disabled value={AREAS_EMPRESA.find((a) => a.valor === area)?.nombre ?? ""} />
            {form.formState.errors.area && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.area.message}</p>
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
          <CardTitle className="text-base">Productos seleccionados</CardTitle>
          <Button type="button" variant="outline" size="sm" disabled={!almacenId} onClick={() => append(ITEM_VACIO)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!almacenId ? (
            <p className="text-sm text-muted-foreground">Selecciona primero el almacén.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-[220px]">Producto</TableHead>
                    <TableHead className="w-20">U.M.</TableHead>
                    <TableHead className="text-right w-28">Precio (US$)</TableHead>
                    <TableHead className="w-16">No valorado</TableHead>
                    <TableHead className="w-24">Cantidad</TableHead>
                    {muestraLote && (
                      <>
                        <TableHead className="w-32">Lote *</TableHead>
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
                    const noValorado = !!items[index]?.noValorado;
                    const sku = skus.find((s) => s.id === skuId);
                    const precio = precioEfectivo(index, noValorado);
                    const skuRequiereLote = sku?.requiereLote ?? false;
                    return (
                      <TableRow key={field.id}>
                        <TableCell className="align-top">
                          <Input disabled value={sku?.codigo ?? ""} />
                        </TableCell>
                        <TableCell className="align-top">
                          <Controller
                            control={form.control}
                            name={`items.${index}.skuId`}
                            render={({ field: selectField }) => (
                              <SkuCombobox
                                skus={skusDelAlmacen}
                                value={selectField.value}
                                emptyMessage="No hay productos de la categoría de este almacén."
                                onSelect={(s) => {
                                  selectField.onChange(s.id);
                                  form.setValue(`items.${index}.unidadMedida`, s.unidadMedida);
                                  form.setValue(`items.${index}.lote`, "");
                                  form.setValue(`items.${index}.fechaProduccion`, undefined);
                                  form.setValue(`items.${index}.fechaVencimiento`, undefined);
                                  cargarPrecio(index, s.id);
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
                        <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                          {items[index]?.unidadMedida || "—"}
                        </TableCell>
                        <TableCell className="align-top pt-4 text-right text-sm">
                          {!skuId ? (
                            "—"
                          ) : precio === null ? (
                            <span className="text-destructive">Sin costo</span>
                          ) : (
                            formatMoneda(precio, "USD")
                          )}
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <Controller
                            control={form.control}
                            name={`items.${index}.noValorado`}
                            render={({ field: checkField }) => (
                              <Checkbox checked={checkField.value} onCheckedChange={(v) => checkField.onChange(!!v)} />
                            )}
                          />
                        </TableCell>
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
                        {muestraLote && (
                          <>
                            <TableCell className="align-top">
                              <Input {...form.register(`items.${index}.lote`)} />
                              {skuRequiereLote && !requierePorAlmacen && (
                                <p className="mt-1 text-xs text-muted-foreground">Este código exige lote.</p>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Input type="date" {...form.register(`items.${index}.fechaProduccion`)} />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input type="date" {...form.register(`items.${index}.fechaVencimiento`)} />
                            </TableCell>
                          </>
                        )}
                        <TableCell className="align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={fields.length === 1}
                            onClick={() => {
                              remove(index);
                              // Las filas después de la eliminada se corren
                              // un índice hacia abajo: hay que re-indexar el
                              // mapa de precios, no solo borrar esta clave.
                              setPreciosPorFila((prev) => {
                                const siguiente: Record<number, number | null> = {};
                                for (const [clave, valor] of Object.entries(prev)) {
                                  const i = Number(clave);
                                  if (i < index) siguiente[i] = valor;
                                  else if (i > index) siguiente[i - 1] = valor;
                                }
                                return siguiente;
                              });
                            }}
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

          <div className="flex justify-end border-t pt-4 text-sm">
            <p className="text-base">
              Total: <span className="font-semibold text-primary">{formatMoneda(total, "USD")}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando..." : edicion ? "Guardar cambios" : "Registrar devolución"}
        </Button>
      </div>
    </form>
  );
}
