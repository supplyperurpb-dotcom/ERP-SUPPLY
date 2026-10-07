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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkuCombobox } from "@/components/shared/sku-combobox";
import { FirmaCanvas } from "@/components/shared/firma-canvas";
import { RetiradorAutorizadoCombobox } from "@/components/shared/retirador-autorizado-combobox";
import { fechaLocalHoy, horaLocalAhora } from "@/lib/utils";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";
import {
  crearConsumoAlmacenAction,
  actualizarConsumoAlmacenAction,
  subirFirmaConsumoAction,
  subirEvidenciaConsumoAction,
} from "@/lib/actions/consumo-almacen-actions";
import type { FilaStockAlmacen } from "@/lib/stock-almacen";

type Opcion = { id: string; nombre: string };
type RetiradorOpcion = { id: string; nombreCompleto: string; dni: string; almacenesIds: string[] };

const ITEM_VACIO = { skuId: "", cantidad: 0, unidadMedida: "" };

export function ConsumoAlmacenForm({
  almacenes,
  stockPorAlmacen,
  retiradores,
  almacenIdInicial,
  edicion,
}: {
  almacenes: Opcion[];
  stockPorAlmacen: Record<string, FilaStockAlmacen[]>;
  retiradores: RetiradorOpcion[];
  almacenIdInicial?: string;
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
      firmaArchivo: "",
      fotoEvidenciaArchivo: "",
      observaciones: "",
      items: [ITEM_VACIO],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const almacenOrigenId = useWatch({ control: form.control, name: "almacenOrigenId" });
  const firmaArchivoActual = edicion?.valoresIniciales.firmaArchivo;
  const fotoArchivoActual = edicion?.valoresIniciales.fotoEvidenciaArchivo;
  const retiradoPorDni = useWatch({ control: form.control, name: "retiradoPorDni" });

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
    const excedeAlgunaLinea = data.items.some((item) => item.cantidad > stockDisponibleDe(item.skuId));
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible en el almacén. Corrígelo antes de guardar.");
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
                    // tener stock en el nuevo almacén: se limpian. Lo mismo
                    // el usuario elegido: puede no tener permiso de retirar
                    // del nuevo almacén.
                    replace([ITEM_VACIO]);
                    form.setValue("retiradoPor", "");
                    form.setValue("retiradoPorDni", "");
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
