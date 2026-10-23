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
import { FirmaCanvas } from "@/components/shared/firma-canvas";
import { RetiradorAutorizadoCombobox } from "@/components/shared/retirador-autorizado-combobox";
import { VehiculoCombobox, type VehiculoOpcionCombobox } from "@/components/shared/vehiculo-combobox";
import { fechaLocalHoy, horaLocalAhora, formatCantidad } from "@/lib/utils";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";
import {
  crearConsumoAlmacenAction,
  actualizarConsumoAlmacenAction,
  subirFirmaConsumoAction,
  subirEvidenciaConsumoAction,
} from "@/lib/actions/consumo-almacen-actions";
import type { FilaStockAlmacen, LoteStock } from "@/lib/stock-almacen";

type Opcion = { id: string; nombre: string; categoriaGeneral: string | null };
type RetiradorOpcion = { id: string; nombreCompleto: string; dni: string; almacenesIds: string[] };

const ITEM_VACIO = {
  skuId: "",
  cantidad: 0,
  unidadMedida: "",
  lote: "",
  fechaProduccion: undefined,
  fechaVencimiento: undefined,
  solicitudDespachoItemId: "",
};

type SolicitudDespachoInicial = {
  id: string;
  numero: string;
  items: { id: string; skuId: string; codigo: string; descripcion: string; unidadMedida: string; cantidadPendiente: number }[];
};

function soloFecha(d: Date | string | undefined): string {
  if (!d) return "";
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

function itemsDesdeSolicitud(solicitud: SolicitudDespachoInicial) {
  return solicitud.items.map((item) => ({
    skuId: item.skuId,
    cantidad: item.cantidadPendiente,
    unidadMedida: item.unidadMedida,
    lote: "",
    fechaProduccion: undefined,
    fechaVencimiento: undefined,
    solicitudDespachoItemId: item.id,
  }));
}

export function ConsumoAlmacenForm({
  almacenes,
  stockPorAlmacen,
  lotesPorAlmacen,
  retiradores,
  vehiculos,
  almacenIdInicial,
  solicitudDespachoInicial,
  edicion,
}: {
  almacenes: Opcion[];
  /** Para almacenes de categoría COMBUSTIBLE, la página ya filtró esta lista
   * a solo SKU de subfamilia "Combustibles" (ver consumos/nuevo/page.tsx). */
  stockPorAlmacen: Record<string, FilaStockAlmacen[]>;
  /** Solo trae datos para almacenes de categoría AGROQUIMICOS_FERTILIZANTES. */
  lotesPorAlmacen: Record<string, Record<string, LoteStock[]>>;
  retiradores: RetiradorOpcion[];
  vehiculos: VehiculoOpcionCombobox[];
  almacenIdInicial?: string;
  /** Presente cuando este consumo viene de "Atender" una Solicitud de
   * Despacho (ver consumos/nuevo/page.tsx): precarga sus líneas pendientes
   * y fija el almacén, pero las cantidades siguen siendo editables por si
   * no se entrega todo lo pedido. */
  solicitudDespachoInicial?: SolicitudDespachoInicial;
  /** Presente solo cuando el formulario edita un consumo ya existente.
   * `stockPorAlmacen` ya viene ajustado por la página (ver
   * consumos/[id]/editar/page.tsx): incluye de vuelta lo que este mismo
   * consumo ya había restado, como si ya estuviera reversado. */
  edicion?: { id: string; valoresIniciales: ConsumoAlmacenInput };
}) {
  const router = useRouter();
  const [firmaFile, setFirmaFile] = useState<File | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);

  const form = useForm<ConsumoAlmacenInput>({
    resolver: zodResolver(consumoAlmacenSchema),
    defaultValues: edicion?.valoresIniciales ?? {
      fecha: fechaLocalHoy() as unknown as Date,
      horaRetiro: horaLocalAhora(),
      almacenOrigenId: almacenIdInicial ?? "",
      retiradoPor: "",
      retiradoPorDni: "",
      vehiculoPlaca: "",
      horometroKilometraje: undefined,
      firmaArchivo: "",
      fotoEvidenciaArchivo: "",
      observaciones: "",
      items: solicitudDespachoInicial ? itemsDesdeSolicitud(solicitudDespachoInicial) : [ITEM_VACIO],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const almacenOrigenId = useWatch({ control: form.control, name: "almacenOrigenId" });
  const firmaArchivoActual = edicion?.valoresIniciales.firmaArchivo;
  const fotoArchivoActual = edicion?.valoresIniciales.fotoEvidenciaArchivo;
  const retiradoPorDni = useWatch({ control: form.control, name: "retiradoPorDni" });
  const vehiculoPlaca = useWatch({ control: form.control, name: "vehiculoPlaca" });

  // Solo se puede elegir a alguien con permiso de retirar de ESTE almacén —
  // ver Listas > Retiradores autorizados.
  const retiradoresDisponibles = almacenOrigenId ? retiradores.filter((r) => r.almacenesIds.includes(almacenOrigenId)) : [];
  const retiradorSeleccionadoId = retiradoresDisponibles.find((r) => r.dni === retiradoPorDni)?.id ?? "";

  // Solo se puede consumir lo que el almacén realmente tiene en stock: el
  // combobox de producto se restringe a esa lista, y sirve también para
  // mostrar/validar la cantidad disponible por línea.
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

  // Agroquímicos y Fertilizantes exige elegir de qué lote se despacha —
  // igual que ya exige lote/fechas al ingresar — y la cantidad a consumir
  // no puede superar lo que queda de ESE lote puntual, no solo el total
  // del SKU en el almacén.
  const almacenActual = almacenes.find((a) => a.id === almacenOrigenId);
  const muestraLote = almacenActual?.categoriaGeneral === "AGROQUIMICOS_FERTILIZANTES";
  // Un almacén de Combustible exige indicar a qué vehículo se despachó y su
  // horómetro/kilometraje (ver validarVehiculoSiAplica en
  // lib/actions/consumo-almacen-actions.ts), y solo deja elegir productos
  // de subfamilia "Combustibles" (ya filtrados por la página en
  // stockPorAlmacen).
  const esCombustible = almacenActual?.categoriaGeneral === "COMBUSTIBLE";

  function lotesDe(skuId: string): LoteStock[] {
    if (!muestraLote || !almacenOrigenId || !skuId) return [];
    return lotesPorAlmacen[almacenOrigenId]?.[skuId] ?? [];
  }

  function stockDisponibleEfectivo(skuId: string, lote: string) {
    if (!muestraLote) return stockDisponibleDe(skuId);
    return lotesDe(skuId).find((l) => l.lote === lote)?.cantidad ?? 0;
  }

  async function handleSubmitConArchivos(e: React.FormEvent) {
    e.preventDefault();
    if (!firmaFile && !firmaArchivoActual) {
      toast.error("Captura la firma de quien retira el material");
      return;
    }
    if (!fotoFile && !fotoArchivoActual) {
      toast.error("Adjunta una foto de evidencia del despacho");
      return;
    }

    setSubiendoArchivos(true);
    try {
      if (firmaFile) {
        const fd = new FormData();
        fd.set("archivo", firmaFile);
        const resultado = await subirFirmaConsumoAction(fd);
        if (resultado.error || !resultado.path) {
          toast.error(resultado.error ?? "No se pudo subir la firma");
          return;
        }
        form.setValue("firmaArchivo", resultado.path, { shouldValidate: true });
      }
      if (fotoFile) {
        const fd = new FormData();
        fd.set("archivo", fotoFile);
        const resultado = await subirEvidenciaConsumoAction(fd);
        if (resultado.error || !resultado.path) {
          toast.error(resultado.error ?? "No se pudo subir la foto");
          return;
        }
        form.setValue("fotoEvidenciaArchivo", resultado.path, { shouldValidate: true });
      }
    } finally {
      setSubiendoArchivos(false);
    }

    await form.handleSubmit(onSubmit)();
  }

  async function onSubmit(data: ConsumoAlmacenInput) {
    const excedeAlgunaLinea = data.items.some(
      (item) => item.cantidad > stockDisponibleEfectivo(item.skuId, item.lote ?? "")
    );
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible en el almacén. Corrígelo antes de guardar.");
      return;
    }
    if (muestraLote && data.items.some((item) => !item.lote?.trim() || !item.fechaProduccion || !item.fechaVencimiento)) {
      toast.error("Selecciona el lote de cada producto en este almacén (exige lote, fecha de producción y vencimiento).");
      return;
    }
    if (esCombustible && !data.vehiculoPlaca?.trim()) {
      toast.error("Selecciona la placa del vehículo que recibe el combustible.");
      return;
    }
    if (esCombustible && (data.horometroKilometraje === undefined || data.horometroKilometraje === null)) {
      toast.error("El horómetro/kilometraje del vehículo es obligatorio en este almacén.");
      return;
    }

    let resultado;
    try {
      resultado = edicion
        ? await actualizarConsumoAlmacenAction(edicion.id, data)
        : await crearConsumoAlmacenAction(data);
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
    if (edicion) {
      toast.success("Consumo actualizado");
      router.push(`/logistica/almacenes/consumos/${edicion.id}`);
      return;
    }
    toast.success("Consumo registrado");
    router.push(resultado?.id ? `/logistica/almacenes/consumos/${resultado.id}` : "/logistica/almacenes/consumos");
  }

  return (
    <form onSubmit={handleSubmitConArchivos} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del consumo</CardTitle>
          {solicitudDespachoInicial && (
            <p className="text-sm text-muted-foreground">
              Atendiendo la solicitud de despacho <strong>{solicitudDespachoInicial.numero}</strong>. Elige de qué
              almacén sale cada producto; las cantidades ya vienen cargadas, ajústalas si no vas a entregar todo lo
              pedido.
            </p>
          )}
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
                    // tener stock en el nuevo almacén: se limpian (o se
                    // vuelven a cargar desde la solicitud de despacho, si
                    // esta venía de una). Lo mismo el usuario elegido: puede
                    // no tener permiso de retirar del nuevo almacén.
                    replace(solicitudDespachoInicial ? itemsDesdeSolicitud(solicitudDespachoInicial) : [ITEM_VACIO]);
                    form.setValue("retiradoPor", "");
                    form.setValue("retiradoPorDni", "");
                    form.setValue("vehiculoPlaca", "");
                    form.setValue("horometroKilometraje", undefined);
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
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="horaRetiro">Hora de retiro</Label>
            <Input id="horaRetiro" type="time" {...form.register("horaRetiro")} />
            {form.formState.errors.horaRetiro && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaRetiro.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <RetiradorAutorizadoCombobox
              retiradores={retiradoresDisponibles}
              value={retiradorSeleccionadoId}
              disabled={!almacenOrigenId}
              onSelect={(r) => {
                form.setValue("retiradoPor", r.nombreCompleto, { shouldValidate: true });
                form.setValue("retiradoPorDni", r.dni, { shouldValidate: true });
              }}
            />
            {form.formState.errors.retiradoPor && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.retiradoPor.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="retiradoPorDni">DNI</Label>
            <Input id="retiradoPorDni" disabled value={retiradoPorDni || ""} />
            {form.formState.errors.retiradoPorDni && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.retiradoPorDni.message}</p>
            )}
          </div>

          {esCombustible && (
            <>
              <div className="space-y-2">
                <Label>Placa del vehículo</Label>
                <VehiculoCombobox
                  vehiculos={vehiculos}
                  value={vehiculoPlaca || ""}
                  onSelect={(v) => form.setValue("vehiculoPlaca", v.placa, { shouldValidate: true })}
                />
                {form.formState.errors.vehiculoPlaca && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.vehiculoPlaca.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="horometroKilometraje">Horómetro / Kilometraje</Label>
                <Controller
                  control={form.control}
                  name="horometroKilometraje"
                  render={({ field }) => (
                    <NumberInput
                      id="horometroKilometraje"
                      value={field.value === undefined || field.value === null ? "" : String(field.value)}
                      onChange={field.onChange}
                    />
                  )}
                />
                {form.formState.errors.horometroKilometraje && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.horometroKilometraje.message}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>

          <div className="space-y-2">
            <Label>Firma de quien retira</Label>
            <FirmaCanvas onChange={setFirmaFile} />
            {firmaArchivoActual && !firmaFile && (
              <p className="text-xs text-muted-foreground">
                Ya hay una firma guardada; dibuja una nueva solo si quieres reemplazarla.
              </p>
            )}
            {form.formState.errors.firmaArchivo && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.firmaArchivo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fotoEvidencia">Foto de evidencia del despacho</Label>
            <Input
              id="fotoEvidencia"
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
            />
            {fotoFile && <p className="text-xs text-muted-foreground">Seleccionada: {fotoFile.name}</p>}
            {fotoArchivoActual && !fotoFile && (
              <p className="text-xs text-muted-foreground">
                Ya hay una foto guardada; adjunta una nueva solo si quieres reemplazarla.
              </p>
            )}
            {form.formState.errors.fotoEvidenciaArchivo && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fotoEvidenciaArchivo.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Productos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Solo aparecen productos con stock disponible en el almacén elegido. El precio unitario ponderado y
              el valor consumido se calculan automáticamente al guardar.
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
            <p className="text-sm text-muted-foreground">Selecciona primero el almacén.</p>
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
                                  // Si esta línea venía de una Solicitud de Despacho, cambiar el
                                  // producto la desvincula (ya no es "el mismo" pedido).
                                  form.setValue(`items.${index}.solicitudDespachoItemId`, "");
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
        <Button type="submit" disabled={form.formState.isSubmitting || subiendoArchivos}>
          {subiendoArchivos || form.formState.isSubmitting
            ? "Guardando..."
            : edicion
              ? "Guardar cambios"
              : "Registrar consumo"}
        </Button>
      </div>
    </form>
  );
}
