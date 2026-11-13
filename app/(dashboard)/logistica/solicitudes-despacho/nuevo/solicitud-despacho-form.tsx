"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fechaLocalHoy, formatCantidad, horaLocalAhora } from "@/lib/utils";
import { AREAS_EMPRESA, AREAS_SOLPED, type AreaEmpresaCodigo } from "@/lib/constants/compras";
import { solicitudDespachoSchema, type SolicitudDespachoInput } from "@/lib/validations/solicitud-despacho";
import { crearSolicitudDespachoAction } from "@/lib/actions/solicitud-despacho-actions";

type SkuOpcion = { id: string; codigo: string; descripcion: string; unidadMedida: string; disponible: number };

// Una fila del stock disponible, repartida por el Área que la trajo (ver
// calcularStockPorAreaParaDespacho) — ya viene filtrada por la página
// según la regla de categoría-por-área (skuPermitidoParaAreaSolped).
type FilaStockArea = {
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  areaDetalle: string | null;
  cantidad: number;
};

function nombreArea(areaDetalle: string | null): string {
  if (!areaDetalle) return "Sin área registrada";
  return AREAS_SOLPED.find((a) => a.valor === areaDetalle)?.nombre ?? areaDetalle;
}

function claveFila(skuId: string, areaDetalle: string | null): string {
  return `${skuId}::${areaDetalle ?? "__sin_area__"}`;
}

export function SolicitudDespachoForm({
  skus,
  stockPorArea,
  areaDetalleUsuario,
  areaInicial = "PRODUCCION",
  usuarioNombre,
  centrosCosto,
  campos,
}: {
  skus: SkuOpcion[];
  stockPorArea: FilaStockArea[];
  /** Área puntual del usuario que pide (ver Usuario.areaDetalle) — se
   * compara contra el área de cada fila de stock para decidir si hay que
   * avisar "este stock no es de tu área". */
  areaDetalleUsuario: string;
  areaInicial?: AreaEmpresaCodigo;
  usuarioNombre: string;
  centrosCosto: string[];
  campos: string[];
}) {
  const router = useRouter();
  const skuPorId = new Map(skus.map((s) => [s.id, s]));
  const centroCostoInicial = centrosCosto[0] ?? "";

  const form = useForm<SolicitudDespachoInput>({
    resolver: zodResolver(solicitudDespachoSchema),
    defaultValues: {
      area: areaInicial,
      fecha: fechaLocalHoy() as unknown as Date,
      hora: horaLocalAhora(),
      observaciones: "",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];

  // Área de origen de cada línea ya agregada, en el mismo índice que
  // `items` — solo para mostrarla en la tabla resumen; no se envía al
  // servidor (SolicitudDespachoItem no guarda de qué área vino).
  const [areaPorItem, setAreaPorItem] = useState<(string | null)[]>([]);

  function removerItem(index: number) {
    remove(index);
    setAreaPorItem((prev) => prev.filter((_, i) => i !== index));
  }

  const cantidadAgregadaPorFila = useMemo(() => {
    const mapa = new Map<string, number>();
    items.forEach((item, i) => {
      const clave = claveFila(item.skuId, areaPorItem[i] ?? null);
      mapa.set(clave, (mapa.get(clave) ?? 0) + (Number(item.cantidad) || 0));
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaPorItem]);

  // Selector de "Agregar producto": lista de stock por área -> (si el área
  // no es la del usuario) confirmación -> cantidad + centro de costo.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filaCandidata, setFilaCandidata] = useState<FilaStockArea | null>(null);
  const [filaElegida, setFilaElegida] = useState<FilaStockArea | null>(null);
  const [cantidadNueva, setCantidadNueva] = useState("");
  const [centroCostoNuevo, setCentroCostoNuevo] = useState(centroCostoInicial);

  function abrirPicker() {
    setPickerOpen(true);
    setFilaCandidata(null);
    setFilaElegida(null);
  }

  function cerrarPicker() {
    setPickerOpen(false);
    setFilaCandidata(null);
    setFilaElegida(null);
  }

  function elegirFila(fila: FilaStockArea) {
    if (fila.areaDetalle && fila.areaDetalle !== areaDetalleUsuario) {
      setFilaCandidata(fila);
      return;
    }
    setFilaElegida(fila);
    setCantidadNueva("");
    setCentroCostoNuevo(centroCostoInicial);
  }

  function restanteDeFila(fila: FilaStockArea): number {
    const yaAgregado = cantidadAgregadaPorFila.get(claveFila(fila.skuId, fila.areaDetalle)) ?? 0;
    return Math.round((fila.cantidad - yaAgregado) * 1000) / 1000;
  }

  const filasVisibles = stockPorArea.filter((fila) => restanteDeFila(fila) > 0.001);
  const restanteElegida = filaElegida ? restanteDeFila(filaElegida) : 0;

  function agregarLinea() {
    if (!filaElegida) return;
    const cantidad = Number(cantidadNueva) || 0;
    if (cantidad <= 0) {
      toast.error("Ingresa una cantidad mayor a 0.");
      return;
    }
    if (cantidad > restanteElegida + 0.001) {
      toast.error(`No puedes pedir más de lo disponible en esa fila (${formatCantidad(restanteElegida)}).`);
      return;
    }
    if (!centroCostoNuevo) {
      toast.error("Selecciona el centro de costo.");
      return;
    }
    append({
      skuId: filaElegida.skuId,
      cantidad,
      unidadMedida: filaElegida.unidadMedida,
      centroCosto: centroCostoNuevo,
      campo: "",
    });
    setAreaPorItem((prev) => [...prev, filaElegida.areaDetalle]);
    toast.success("Producto agregado");
    setFilaElegida(null);
    setCantidadNueva("");
  }

  async function onSubmit(data: SolicitudDespachoInput) {
    const excedeAlgunaLinea = data.items.some((item) => item.cantidad > (skuPorId.get(item.skuId)?.disponible ?? 0));
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible. Corrígelo antes de guardar.");
      return;
    }

    let resultado;
    try {
      resultado = await crearSolicitudDespachoAction(data);
    } catch (err) {
      console.error("Error al guardar la solicitud de despacho:", err);
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
      window.open(`/api/pdf/solicitud-despacho/${resultado.id}`, "_blank");
      router.push(`/logistica/solicitudes-despacho/${resultado.id}`);
    } else {
      router.push("/logistica/solicitudes-despacho");
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
            <Label>Usuario</Label>
            <Input disabled value={usuarioNombre} />
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <Controller
              control={form.control}
              name="area"
              render={({ field }) => (
                <Select value={field.value} disabled>
                  <SelectTrigger className="cursor-not-allowed bg-muted opacity-70">
                    <SelectValue>{AREAS_EMPRESA.find((a) => a.valor === field.value)?.nombre}</SelectValue>
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
            <p className="text-xs text-muted-foreground">Fijada según tu área asignada.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de emisión</Label>
            <Input id="fecha" type="date" disabled {...form.register("fecha")} />
            {form.formState.errors.fecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fecha.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hora">Hora</Label>
            <Input id="hora" type="time" disabled {...form.register("hora")} />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="observaciones">Especificar Uso:</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
            {form.formState.errors.observaciones && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.observaciones.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Productos</CardTitle>
            <p className="text-sm text-muted-foreground">Solo aparecen productos con stock disponible que puedes pedir.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={abrirPicker}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.formState.errors.items?.root && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.items.root.message}</p>
          )}
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no agregaste ningún producto. Usa el botón &quot;Agregar producto&quot; de arriba.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-[200px]">Producto</TableHead>
                    <TableHead className="w-36">Área de origen</TableHead>
                    <TableHead className="w-28 text-right">Cantidad</TableHead>
                    <TableHead className="w-20">U.M.</TableHead>
                    <TableHead className="w-44">Centro de costo</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const skuId = items[index]?.skuId ?? "";
                    const sku = skuPorId.get(skuId);
                    return (
                      <TableRow key={field.id}>
                        <TableCell className="font-mono text-sm">{sku?.codigo ?? "—"}</TableCell>
                        <TableCell>{sku?.descripcion ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{nombreArea(areaPorItem[index] ?? null)}</TableCell>
                        <TableCell className="text-right">{formatCantidad(Number(items[index]?.cantidad) || 0)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{items[index]?.unidadMedida || "—"}</TableCell>
                        <TableCell className="text-sm">{items[index]?.centroCosto || "—"}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removerItem(index)}>
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
          {form.formState.isSubmitting ? "Guardando..." : "Registrar solicitud"}
        </Button>
      </div>

      {/* Agregar producto: lista de stock por área -> cantidad + centro de costo. */}
      <Dialog open={pickerOpen} onOpenChange={(v) => (v ? setPickerOpen(true) : cerrarPicker())}>
        <DialogContent className="sm:max-w-lg">
          {!filaElegida && (
            <>
              <DialogHeader>
                <DialogTitle>Stock disponible</DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {filasVisibles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay stock disponible de productos que puedas pedir.</p>
                )}
                {filasVisibles.map((fila) => (
                  <button
                    key={claveFila(fila.skuId, fila.areaDetalle)}
                    type="button"
                    onClick={() => elegirFila(fila)}
                    className="w-full rounded-md border p-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent/40"
                  >
                    <p className="font-medium">
                      {fila.codigo} — {fila.descripcion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Área: {nombreArea(fila.areaDetalle)} · Disponible: {formatCantidad(restanteDeFila(fila))} {fila.unidadMedida}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {filaElegida && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {filaElegida.codigo} — {filaElegida.descripcion}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Área: {nombreArea(filaElegida.areaDetalle)} · Disponible: {formatCantidad(restanteElegida)} {filaElegida.unidadMedida}
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <NumberInput value={cantidadNueva} onChange={setCantidadNueva} />
                </div>
                <div className="space-y-2">
                  <Label>Centro de costo</Label>
                  <Select value={centroCostoNuevo} onValueChange={setCentroCostoNuevo}>
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
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFilaElegida(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={agregarLinea}>
                    Añadir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={filaCandidata !== null}
        onOpenChange={(v) => {
          if (!v) setFilaCandidata(null);
        }}
        title="El stock de este producto no es de su área, ¿desea continuar?"
        confirmLabel="Sí"
        cancelLabel="No"
        onConfirm={() => {
          if (!filaCandidata) return;
          setFilaElegida(filaCandidata);
          setCantidadNueva("");
          setCentroCostoNuevo(centroCostoInicial);
          setFilaCandidata(null);
        }}
      />
    </form>
  );
}
