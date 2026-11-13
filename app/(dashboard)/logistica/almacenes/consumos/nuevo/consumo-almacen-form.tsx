"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { categoriaAlmacenExigidaPorSku, ETIQUETA_CATEGORIA_ALMACEN } from "@/lib/constants/sku";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";
import {
  crearConsumoAlmacenAction,
  actualizarConsumoAlmacenAction,
  subirFirmaConsumoAction,
  subirEvidenciaConsumoAction,
  obtenerStockPorAlmacenParaSkuAction,
} from "@/lib/actions/consumo-almacen-actions";
import type { FilaStockAlmacen, LoteStock, StockPorAlmacen } from "@/lib/stock-almacen";

type Opcion = { id: string; codigo: string; nombre: string; categoriaGeneral: string | null };
type RetiradorOpcion = { id: string; nombreCompleto: string; dni: string; area: string; almacenesIds: string[] };

function itemVacio(almacenOrigenId: string) {
  return {
    almacenOrigenId,
    skuId: "",
    cantidad: 0,
    unidadMedida: "",
    lote: "",
    fechaProduccion: undefined,
    fechaVencimiento: undefined,
    solicitudDespachoItemId: "",
  };
}

// Una línea pendiente de atender, de alguna de las Solicitudes de Despacho
// que se están atendiendo en este consumo — ver "Ver Productos" más abajo.
type PendienteDespacho = {
  id: string; // SolicitudDespachoItem.id
  solicitudId: string;
  solicitudNumero: string;
  skuId: string;
  codigo: string;
  descripcion: string;
  subfamilia: string;
  unidadMedida: string;
  centroCosto: string;
  cantidadPendiente: number;
};

type SolicitudDespachoInicial = {
  id: string;
  numero: string;
  area: string;
  items: Omit<PendienteDespacho, "solicitudId" | "solicitudNumero">[];
};

function soloFecha(d: Date | string | undefined): string {
  if (!d) return "";
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

export function ConsumoAlmacenForm({
  almacenes,
  stockPorAlmacen,
  lotesPorAlmacen,
  retiradores,
  vehiculos,
  almacenIdInicial,
  solicitudesDespachoInicial,
  edicion,
}: {
  almacenes: Opcion[];
  /** Para almacenes de categoría COMBUSTIBLE, la página ya filtró esta lista
   * a solo SKU de subfamilia "Combustibles" (ver consumos/nuevo/page.tsx).
   * Solo se usa en el flujo manual (sin solicitudes de despacho). */
  stockPorAlmacen: Record<string, FilaStockAlmacen[]>;
  /** Lotes con stock por almacén y SKU, para cada almacén de categoría
   * PESTICIDAS o FERTILIZANTES que pueda aparecer en el formulario (el
   * elegido en el flujo manual, o cualquiera de los elegibles si se están
   * atendiendo Solicitudes de Despacho). */
  lotesPorAlmacen: Record<string, Record<string, LoteStock[]>>;
  retiradores: RetiradorOpcion[];
  vehiculos: VehiculoOpcionCombobox[];
  almacenIdInicial?: string;
  /** Presente cuando este consumo atiende una o varias Solicitudes de
   * Despacho (ver consumos/nuevo/page.tsx): ya no hay un único "Almacén de
   * origen" — cada línea se arma con el botón "Ver Productos", que deja
   * repartir un mismo producto entre varios almacenes. */
  solicitudesDespachoInicial: SolicitudDespachoInicial[];
  /** Presente solo cuando el formulario edita un consumo ya existente.
   * `stockPorAlmacen`/`lotesPorAlmacen` ya vienen ajustados por la página
   * (ver consumos/[id]/editar/page.tsx): incluyen de vuelta lo que este
   * mismo consumo ya había restado, como si ya estuviera reversado. */
  edicion?: { id: string; valoresIniciales: ConsumoAlmacenInput };
}) {
  const router = useRouter();
  const [firmaFile, setFirmaFile] = useState<File | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  // Fecha de registro: siempre hoy, bloqueada — igual que en Ingreso. Al
  // editar, queda como se registró originalmente (nunca se retrofecha).
  const fecha = edicion?.valoresIniciales.fecha ?? (fechaLocalHoy() as unknown as Date);

  // Atendiendo una o varias Solicitudes de Despacho: no hay un único
  // almacén de origen, cada línea trae el suyo (ver "Ver Productos").
  const atendiendoSolicitudes = solicitudesDespachoInicial.length > 0;
  // Un consumo ya existente puede tener líneas de más de un almacén (si
  // vino de atender solicitudes) — en ese caso tampoco hay un único
  // almacén que mostrar arriba, aunque ya no se pueda seguir repartiendo
  // (ver más abajo, "Ver Productos" no aplica al editar).
  const almacenesDeEdicion = edicion ? new Set(edicion.valoresIniciales.items.map((it) => it.almacenOrigenId)) : new Set<string>();
  const esEdicionMultiAlmacen = edicion ? almacenesDeEdicion.size > 1 : false;
  const sinAlmacenGeneral = atendiendoSolicitudes || esEdicionMultiAlmacen;

  const form = useForm<ConsumoAlmacenInput>({
    resolver: zodResolver(consumoAlmacenSchema),
    defaultValues: edicion?.valoresIniciales ?? {
      fecha,
      fechaContabilizacion: fechaLocalHoy() as unknown as Date,
      horaRetiro: horaLocalAhora(),
      retiradoPor: "",
      retiradoPorDni: "",
      vehiculoPlaca: "",
      horometroKilometraje: undefined,
      firmaArchivo: "",
      fotoEvidenciaArchivo: "",
      observaciones: "",
      items: atendiendoSolicitudes ? [] : [itemVacio(almacenIdInicial ?? "")],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const firmaArchivoActual = edicion?.valoresIniciales.firmaArchivo;
  const fotoArchivoActual = edicion?.valoresIniciales.fotoEvidenciaArchivo;
  const retiradoPorDni = useWatch({ control: form.control, name: "retiradoPorDni" });
  const vehiculoPlaca = useWatch({ control: form.control, name: "vehiculoPlaca" });

  // --- Flujo manual (sin solicitudes de despacho detrás): un único
  // almacén de origen para todas las líneas, elegido arriba — igual que
  // antes de repartir el almacén por línea.
  const [almacenManualId, setAlmacenManualId] = useState(almacenIdInicial ?? "");
  const almacenManual = almacenes.find((a) => a.id === almacenManualId);
  const stockOrigenManual = almacenManualId ? stockPorAlmacen[almacenManualId] ?? [] : [];
  const skusDisponiblesManual = stockOrigenManual.map((s) => ({
    id: s.skuId,
    codigo: s.codigo,
    descripcion: s.descripcion,
    unidadMedida: s.unidadMedida,
  }));
  const stockPorSkuIdManual = new Map(stockOrigenManual.map((s) => [s.skuId, s]));

  // --- Líneas ya en la tabla: de qué almacén(es) es cada una (para
  // mostrar la columna Almacén, y para derivar retirador/lote/combustible
  // cuando no hay un único almacén de origen).
  const almacenPorId = new Map(almacenes.map((a) => [a.id, a]));
  const almacenesUsados = [...new Set(items.map((it) => it.almacenOrigenId).filter(Boolean))]
    .map((id) => almacenPorId.get(id))
    .filter((a): a is Opcion => !!a);

  const almacenActual = sinAlmacenGeneral ? null : almacenManual;
  const muestraLote = sinAlmacenGeneral
    ? almacenesUsados.some((a) => a.categoriaGeneral === "PESTICIDAS" || a.categoriaGeneral === "FERTILIZANTES")
    : almacenActual?.categoriaGeneral === "PESTICIDAS" || almacenActual?.categoriaGeneral === "FERTILIZANTES";
  // Un almacén de Combustible exige indicar a qué vehículo se despachó y su
  // horómetro/kilometraje (ver validarVehiculoSiAplica en
  // lib/actions/consumo-almacen-actions.ts).
  const esCombustible = sinAlmacenGeneral
    ? almacenesUsados.some((a) => a.categoriaGeneral === "COMBUSTIBLE")
    : almacenActual?.categoriaGeneral === "COMBUSTIBLE";

  // Al atender Solicitudes de Despacho, quien retira se filtra por el
  // ÁREA de esas solicitudes (no por almacén: recién se sabe de qué
  // almacén(es) sale cada línea después de pasar por "Ver Productos", y
  // no tendría sentido obligar a elegir productos antes de poder elegir
  // quién retira). En el flujo manual (o editando un consumo que no vino
  // de una solicitud) sigue siendo por permiso de almacén — ver Listas >
  // Retiradores autorizados.
  const areaSolicitudes = solicitudesDespachoInicial[0]?.area ?? null;
  const almacenIdsParaRetirador = esEdicionMultiAlmacen ? almacenesUsados.map((a) => a.id) : almacenManualId ? [almacenManualId] : [];
  const retiradoresDisponibles = atendiendoSolicitudes
    ? areaSolicitudes
      ? retiradores.filter((r) => r.area === areaSolicitudes)
      : []
    : almacenIdsParaRetirador.length > 0
      ? retiradores.filter((r) => almacenIdsParaRetirador.every((id) => r.almacenesIds.includes(id)))
      : [];
  const retiradorSeleccionadoId = retiradoresDisponibles.find((r) => r.dni === retiradoPorDni)?.id ?? "";

  function stockDisponibleManual(skuId: string) {
    return stockPorSkuIdManual.get(skuId)?.cantidad ?? 0;
  }

  function lotesDe(almacenId: string, skuId: string): LoteStock[] {
    if (!almacenId || !skuId) return [];
    return lotesPorAlmacen[almacenId]?.[skuId] ?? [];
  }

  function stockDisponibleEfectivo(almacenId: string, skuId: string, lote: string) {
    const almacen = almacenPorId.get(almacenId);
    const requiereLote = almacen?.categoriaGeneral === "PESTICIDAS" || almacen?.categoriaGeneral === "FERTILIZANTES";
    if (!requiereLote) return sinAlmacenGeneral ? Infinity : stockDisponibleManual(skuId);
    return lotesDe(almacenId, skuId).find((l) => l.lote === lote)?.cantidad ?? 0;
  }

  // --- "Ver Productos": categoría -> producto pendiente -> reparto por
  // almacén. Solo aplica al crear, atendiendo solicitudes de despacho.
  const pendientesDespacho: PendienteDespacho[] = useMemo(
    () =>
      solicitudesDespachoInicial.flatMap((s) =>
        s.items.map((it) => ({ ...it, solicitudId: s.id, solicitudNumero: s.numero }))
      ),
    [solicitudesDespachoInicial]
  );

  function cantidadYaAsignada(pendienteId: string): number {
    return items
      .filter((it) => it.solicitudDespachoItemId === pendienteId)
      .reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
  }

  const [verProductosOpen, setVerProductosOpen] = useState(false);
  const [categoriaElegida, setCategoriaElegida] = useState<string | null>(null);
  const [productoElegido, setProductoElegido] = useState<PendienteDespacho | null>(null);
  const [stockSplit, setStockSplit] = useState<StockPorAlmacen[]>([]);
  const [cargandoStockSplit, setCargandoStockSplit] = useState(false);
  const [cantidadesSplit, setCantidadesSplit] = useState<Record<string, string>>({});
  // SolicitudDespachoItem.id de la línea que se está reeditando (ver
  // "Editar" en la tabla de productos) — mientras no se confirme con
  // "Agregar", las líneas viejas de este producto siguen en la tabla (por
  // si se cancela), y no cuentan como "ya asignadas" al calcular cuánto
  // queda por repartir.
  const [editandoPendienteId, setEditandoPendienteId] = useState<string | null>(null);

  function cerrarVerProductos() {
    setVerProductosOpen(false);
    setCategoriaElegida(null);
    setProductoElegido(null);
    setStockSplit([]);
    setCantidadesSplit({});
    setEditandoPendienteId(null);
  }

  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const p of pendientesDespacho) {
      const restante = p.cantidadPendiente - cantidadYaAsignada(p.id);
      if (restante <= 0) continue;
      const categoria = categoriaAlmacenExigidaPorSku({ codigo: p.codigo, descripcion: p.descripcion, subfamilia: p.subfamilia });
      if (categoria) set.add(categoria);
    }
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientesDespacho, items]);

  const productosDeCategoria = useMemo(() => {
    if (!categoriaElegida) return [];
    return pendientesDespacho
      .filter(
        (p) =>
          categoriaAlmacenExigidaPorSku({ codigo: p.codigo, descripcion: p.descripcion, subfamilia: p.subfamilia }) === categoriaElegida
      )
      .map((p) => ({ ...p, asignada: cantidadYaAsignada(p.id), restante: p.cantidadPendiente - cantidadYaAsignada(p.id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientesDespacho, categoriaElegida, items]);

  // Un almacén que exige lote aparece como varias filas (una por lote, ver
  // calcularStockPorAlmacenParaSku) — se identifica cada fila por
  // almacén+lote, no solo por almacén, para no mezclar sus cantidades.
  function claveSplit(fila: StockPorAlmacen): string {
    return `${fila.almacenId}::${fila.lote ?? "__sin_lote__"}`;
  }

  async function elegirProducto(p: PendienteDespacho) {
    setProductoElegido(p);
    setCantidadesSplit({});
    setCargandoStockSplit(true);
    try {
      const stock = await obtenerStockPorAlmacenParaSkuAction(p.skuId);
      setStockSplit(stock);
    } finally {
      setCargandoStockSplit(false);
    }
  }

  // "Editar" desde la tabla de productos: reabre el mismo paso de reparto
  // por almacén/lote, precargado con lo que ya se había repartido. Las
  // líneas viejas de este producto NO se tocan todavía — recién se
  // reemplazan si se confirma con "Agregar" (ver más abajo); así cancelar
  // o cerrar la ventana no pierde nada.
  async function editarProducto(pendiente: PendienteDespacho) {
    const cantidadesPrevias: Record<string, string> = {};
    for (const item of items) {
      if (item.solicitudDespachoItemId !== pendiente.id) continue;
      const clave = `${item.almacenOrigenId}::${item.lote || "__sin_lote__"}`;
      cantidadesPrevias[clave] = String((Number(cantidadesPrevias[clave]) || 0) + (Number(item.cantidad) || 0));
    }
    setEditandoPendienteId(pendiente.id);
    setCategoriaElegida(
      categoriaAlmacenExigidaPorSku({ codigo: pendiente.codigo, descripcion: pendiente.descripcion, subfamilia: pendiente.subfamilia })
    );
    setProductoElegido(pendiente);
    setCantidadesSplit(cantidadesPrevias);
    setCargandoStockSplit(true);
    setVerProductosOpen(true);
    try {
      const stock = await obtenerStockPorAlmacenParaSkuAction(pendiente.skuId);
      setStockSplit(stock);
    } finally {
      setCargandoStockSplit(false);
    }
  }

  // Mientras se reedita un producto, sus líneas viejas siguen en `items`
  // (todavía no se borraron) — no deben contar como "ya asignadas", o el
  // reparto disponible se vería reducido por algo que está a punto de
  // reemplazarse.
  const restanteProducto = productoElegido
    ? productoElegido.cantidadPendiente - (editandoPendienteId === productoElegido.id ? 0 : cantidadYaAsignada(productoElegido.id))
    : 0;
  const sumaSplit = Object.values(cantidadesSplit).reduce((acc, v) => acc + (Number(v) || 0), 0);

  function agregarSplit() {
    if (!productoElegido) return;
    if (sumaSplit <= 0) {
      toast.error("Ingresa cuánto retirar de al menos una fila.");
      return;
    }
    if (sumaSplit > restanteProducto + 0.001) {
      toast.error(`La suma (${formatCantidad(sumaSplit)}) no puede superar lo pendiente (${formatCantidad(restanteProducto)}).`);
      return;
    }
    for (const fila of stockSplit) {
      const cantidad = Number(cantidadesSplit[claveSplit(fila)]) || 0;
      if (cantidad > fila.cantidad + 0.001) {
        toast.error(`${fila.nombre}${fila.lote ? ` (lote ${fila.lote})` : ""}: no hay ${formatCantidad(cantidad)} disponible (stock: ${formatCantidad(fila.cantidad)}).`);
        return;
      }
    }

    if (editandoPendienteId === productoElegido.id) {
      const indicesViejos: number[] = [];
      items.forEach((item, i) => {
        if (item.solicitudDespachoItemId === productoElegido.id) indicesViejos.push(i);
      });
      if (indicesViejos.length > 0) remove(indicesViejos);
    }

    for (const fila of stockSplit) {
      const cantidad = Number(cantidadesSplit[claveSplit(fila)]) || 0;
      if (cantidad <= 0) continue;
      append({
        almacenOrigenId: fila.almacenId,
        skuId: productoElegido.skuId,
        cantidad,
        unidadMedida: productoElegido.unidadMedida,
        lote: fila.lote ?? "",
        fechaProduccion: fila.fechaProduccion ? (soloFecha(fila.fechaProduccion) as unknown as Date) : undefined,
        fechaVencimiento: fila.fechaVencimiento ? (soloFecha(fila.fechaVencimiento) as unknown as Date) : undefined,
        solicitudDespachoItemId: productoElegido.id,
      });
    }
    toast.success(editandoPendienteId === productoElegido.id ? "Producto actualizado" : "Producto agregado");
    setProductoElegido(null);
    setStockSplit([]);
    setCantidadesSplit({});
    setEditandoPendienteId(null);
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
    if (data.items.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }
    const excedeAlgunaLinea = data.items.some(
      (item) => item.cantidad > stockDisponibleEfectivo(item.almacenOrigenId, item.skuId, item.lote ?? "")
    );
    if (excedeAlgunaLinea) {
      toast.error("Hay productos cuya cantidad excede el stock disponible en su almacén. Corrígelo antes de guardar.");
      return;
    }
    const faltaLote = data.items.some((item) => {
      const almacen = almacenPorId.get(item.almacenOrigenId);
      const requiereLote = almacen?.categoriaGeneral === "PESTICIDAS" || almacen?.categoriaGeneral === "FERTILIZANTES";
      return requiereLote && (!item.lote?.trim() || !item.fechaProduccion || !item.fechaVencimiento);
    });
    if (faltaLote) {
      toast.error("Selecciona el lote de cada producto que lo exige (lote, fecha de producción y vencimiento).");
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

  const puedeAgregarManual = !sinAlmacenGeneral && !!almacenManualId;

  return (
    <form onSubmit={handleSubmitConArchivos} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del consumo</CardTitle>
          {atendiendoSolicitudes && (
            <p className="text-sm text-muted-foreground">
              Atendiendo{" "}
              {solicitudesDespachoInicial.map((s, i) => (
                <span key={s.id}>
                  <strong>{s.numero}</strong>
                  {i < solicitudesDespachoInicial.length - 1 ? ", " : ""}
                </span>
              ))}
              . Usa &quot;Ver Productos&quot; para elegir qué despachar y de qué almacén(es).
            </p>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!sinAlmacenGeneral && (
            <div className="space-y-2">
              <Label>Almacén de origen</Label>
              <Select
                value={almacenManualId}
                onValueChange={(valor) => {
                  setAlmacenManualId(valor);
                  // Los productos de las líneas ya cargadas pueden no tener
                  // stock en el nuevo almacén: se limpian. Lo mismo el
                  // retirador elegido: puede no tener permiso ahí.
                  replace([itemVacio(valor)]);
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
                      <span className="font-mono text-muted-foreground">{a.codigo}</span> — {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            <Label htmlFor="fechaContabilizacion">Fecha de Contabilización</Label>
            <Input
              id="fechaContabilizacion"
              type="date"
              max={fechaLocalHoy()}
              {...form.register("fechaContabilizacion")}
            />
            {form.formState.errors.fechaContabilizacion && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fechaContabilizacion.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="horaRetiro">Hora de retiro</Label>
            <Input
              id="horaRetiro"
              type="time"
              readOnly
              className="cursor-not-allowed bg-muted opacity-70"
              {...form.register("horaRetiro")}
            />
            {form.formState.errors.horaRetiro && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaRetiro.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <RetiradorAutorizadoCombobox
              retiradores={retiradoresDisponibles}
              value={retiradorSeleccionadoId}
              disabled={atendiendoSolicitudes ? !areaSolicitudes : almacenIdsParaRetirador.length === 0}
              mensajeDeshabilitado={esEdicionMultiAlmacen ? "Agrega primero un producto." : "Selecciona primero el almacén."}
              mensajeVacio={
                atendiendoSolicitudes
                  ? "No hay retiradores autorizados para esta área. Agrégalo en Listas > Retiradores autorizados."
                  : undefined
              }
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
              {atendiendoSolicitudes
                ? "Usa \"Ver Productos\" para elegir qué despachar de las solicitudes seleccionadas."
                : "Solo aparecen productos con stock disponible en el almacén elegido. El precio unitario ponderado y el valor consumido se calculan automáticamente al guardar."}
            </p>
          </div>
          {atendiendoSolicitudes ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setVerProductosOpen(true)}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Ver Productos
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={!puedeAgregarManual} onClick={() => append(itemVacio(almacenManualId))}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!sinAlmacenGeneral && !almacenManualId ? (
            <p className="text-sm text-muted-foreground">Selecciona primero el almacén.</p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {atendiendoSolicitudes ? "Todavía no agregaste ningún producto. Usa \"Ver Productos\"." : "Agrega al menos un producto."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {sinAlmacenGeneral && <TableHead className="w-40">Almacén</TableHead>}
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-[260px]">Producto</TableHead>
                    <TableHead className="w-28">Cantidad</TableHead>
                    <TableHead className="w-20">U.M.</TableHead>
                    {!sinAlmacenGeneral && <TableHead className="w-28">Stock disponible</TableHead>}
                    {atendiendoSolicitudes && <TableHead className="w-36">Centro de costo</TableHead>}
                    {muestraLote && (
                      <>
                        <TableHead className="w-48">Lote *</TableHead>
                        <TableHead className="w-32">F. producción</TableHead>
                        <TableHead className="w-32">F. vencimiento</TableHead>
                      </>
                    )}
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const itemAlmacenId = items[index]?.almacenOrigenId ?? "";
                    const itemAlmacen = almacenPorId.get(itemAlmacenId);
                    const skuId = items[index]?.skuId ?? "";
                    const loteElegido = items[index]?.lote ?? "";
                    const lotesSku = lotesDe(itemAlmacenId, skuId);
                    const disponible = sinAlmacenGeneral ? null : stockDisponibleEfectivo(itemAlmacenId, skuId, loteElegido);
                    const cantidad = Number(items[index]?.cantidad) || 0;
                    const excede = !sinAlmacenGeneral && skuId !== "" && disponible !== null && cantidad > disponible;
                    const filaRequiereLote =
                      itemAlmacen?.categoriaGeneral === "PESTICIDAS" || itemAlmacen?.categoriaGeneral === "FERTILIZANTES";
                    const codigoManual = stockOrigenManual.find((s) => s.skuId === skuId)?.codigo ?? "";
                    const pendienteDeLaFila = sinAlmacenGeneral
                      ? pendientesDespacho.find((p) => p.id === items[index]?.solicitudDespachoItemId)
                      : undefined;
                    return (
                      <TableRow key={field.id}>
                        {sinAlmacenGeneral && (
                          <TableCell className="align-top pt-4 text-sm">
                            <span className="font-mono text-muted-foreground">{itemAlmacen?.codigo}</span> {itemAlmacen?.nombre}
                          </TableCell>
                        )}
                        <TableCell className="align-top pt-4 text-sm">
                          {sinAlmacenGeneral ? pendienteDeLaFila?.codigo : <Input disabled value={codigoManual} />}
                        </TableCell>
                        <TableCell className="align-top">
                          {sinAlmacenGeneral ? (
                            <p className="pt-2 text-sm">{pendienteDeLaFila?.descripcion}</p>
                          ) : (
                            <>
                              <Controller
                                control={form.control}
                                name={`items.${index}.skuId`}
                                render={({ field: selectField }) => (
                                  <SkuCombobox
                                    skus={skusDisponiblesManual}
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
                            </>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {sinAlmacenGeneral ? (
                            <p className="pt-2 text-sm">{formatCantidad(cantidad)}</p>
                          ) : (
                            <>
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
                                  La cantidad excede el stock disponible ({formatCantidad(disponible ?? 0)}).
                                </p>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                          {items[index]?.unidadMedida || "—"}
                        </TableCell>
                        {!sinAlmacenGeneral && (
                          <TableCell className="align-top pt-4 text-sm">{skuId ? formatCantidad(disponible ?? 0) : "—"}</TableCell>
                        )}
                        {atendiendoSolicitudes && (
                          <TableCell className="align-top pt-4 text-sm text-muted-foreground">
                            {pendienteDeLaFila?.centroCosto ?? "—"}
                          </TableCell>
                        )}
                        {muestraLote && (
                          <>
                            <TableCell className="align-top">
                              {atendiendoSolicitudes ? (
                                // El lote ya se eligió en "Ver Productos" (reparto por
                                // almacén/lote) — acá solo se muestra; para cambiarlo hay
                                // que usar el botón "Editar" de esta fila.
                                <p className="pt-2 text-sm">{loteElegido || "—"}</p>
                              ) : filaRequiereLote ? (
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
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
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
                          <div className="flex items-center">
                            {atendiendoSolicitudes && pendienteDeLaFila && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => editarProducto(pendienteDeLaFila)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={!sinAlmacenGeneral && fields.length === 1}
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

      {/* "Ver Productos": categoría -> producto pendiente -> reparto por almacén. */}
      <Dialog open={verProductosOpen} onOpenChange={(v) => (v ? setVerProductosOpen(true) : cerrarVerProductos())}>
        <DialogContent className="sm:max-w-lg">
          {!categoriaElegida && (
            <>
              <DialogHeader>
                <DialogTitle>¿Qué categoría quieres despachar?</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {categoriasDisponibles.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ya agregaste todo lo pendiente de estas solicitudes.</p>
                )}
                {categoriasDisponibles.map((c) => (
                  <Button key={c} variant="outline" className="w-full justify-start" onClick={() => setCategoriaElegida(c)}>
                    {ETIQUETA_CATEGORIA_ALMACEN[c] ?? c}
                  </Button>
                ))}
              </div>
            </>
          )}

          {categoriaElegida && !productoElegido && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCategoriaElegida(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  Productos de {ETIQUETA_CATEGORIA_ALMACEN[categoriaElegida] ?? categoriaElegida}
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {productosDeCategoria.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.restante <= 0}
                    onClick={() => elegirProducto(p)}
                    className="w-full rounded-md border p-2 text-left text-sm transition-colors hover:border-primary hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="font-medium">
                      {p.codigo} — {p.descripcion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Solicitud {p.solicitudNumero} · Solicitado: {formatCantidad(p.cantidadPendiente + p.asignada)} ·
                      Asignado: {formatCantidad(p.asignada)} · Pendiente: {formatCantidad(p.restante)} {p.unidadMedida}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {productoElegido && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setProductoElegido(null);
                      setStockSplit([]);
                      setCantidadesSplit({});
                      setEditandoPendienteId(null);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {productoElegido.codigo} — {productoElegido.descripcion}
                  {editandoPendienteId === productoElegido.id && (
                    <span className="text-xs font-normal text-muted-foreground">(editando)</span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Pendiente: {formatCantidad(restanteProducto)} {productoElegido.unidadMedida} · Centro de costo:{" "}
                {productoElegido.centroCosto}. Reparte cuánto retirar de cada almacén (o lote).
              </p>
              {cargandoStockSplit ? (
                <p className="text-sm text-muted-foreground">Cargando stock por almacén…</p>
              ) : stockSplit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay stock de este producto en ningún almacén.</p>
              ) : (
                <div className="space-y-3">
                  {stockSplit.map((fila) => (
                    <div key={claveSplit(fila)} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          <span className="font-mono text-muted-foreground">{fila.codigo}</span> {fila.nombre}
                          {fila.lote && <span className="text-muted-foreground"> — Lote {fila.lote}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Disponible: {formatCantidad(fila.cantidad)}
                          {fila.lote && (
                            <>
                              {" "}
                              · Prod.: {soloFecha(fila.fechaProduccion ?? undefined) || "—"} · Venc.:{" "}
                              {soloFecha(fila.fechaVencimiento ?? undefined) || "—"}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="w-28">
                        <NumberInput
                          value={cantidadesSplit[claveSplit(fila)] ?? ""}
                          onChange={(v) => setCantidadesSplit((prev) => ({ ...prev, [claveSplit(fila)]: v }))}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-sm">
                    Total repartido:{" "}
                    <span className={sumaSplit > restanteProducto + 0.001 ? "font-medium text-destructive" : "font-medium"}>
                      {formatCantidad(sumaSplit)}
                    </span>{" "}
                    / {formatCantidad(restanteProducto)}
                  </p>
                  <div className="flex justify-end">
                    <Button type="button" onClick={agregarSplit}>
                      Agregar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}
