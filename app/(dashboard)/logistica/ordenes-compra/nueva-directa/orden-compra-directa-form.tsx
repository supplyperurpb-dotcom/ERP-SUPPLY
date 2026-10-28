"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProveedorSelectCombobox, type ProveedorOpcionSelect } from "@/components/shared/proveedor-select-combobox";
import { SkuCombobox, type SkuOpcionCombobox } from "@/components/shared/sku-combobox";
import { fechaLocalHoy, fechaLocalManana, formatMoneda } from "@/lib/utils";
import {
  CATEGORIAS_COMPRA,
  CONDICIONES_PAGO,
  IGV_TASA,
  LUGARES_ENTREGA,
  NOMBRE_ORDEN,
  type CategoriaCompraCodigo,
  type TipoOrdenCodigo,
} from "@/lib/constants/compras";
import { MONEDAS } from "@/lib/constants/moneda";
import { crearOrdenCompraDirectaAction } from "@/lib/actions/orden-compra-actions";

type SkuOpcion = SkuOpcionCombobox & { categoria: string };

type FilaItem = {
  skuId: string;
  codigo: string;
  descripcionSku: string;
  unidadMedida: string;
  cantidad: string;
  precioUnitario: string;
  gravado: boolean;
  centroCosto: string;
  descripcion: string;
};

function filaVacia(centroCostoInicial: string): FilaItem {
  return {
    skuId: "",
    codigo: "",
    descripcionSku: "",
    unidadMedida: "",
    cantidad: "1",
    precioUnitario: "",
    gravado: true,
    centroCosto: centroCostoInicial,
    descripcion: "",
  };
}

export function OrdenCompraDirectaForm({
  skus,
  tipoOrden,
  proveedores,
  centrosCosto,
  numerosTentativos,
}: {
  skus: SkuOpcion[];
  tipoOrden: TipoOrdenCodigo;
  proveedores: ProveedorOpcionSelect[];
  centrosCosto: string[];
  numerosTentativos: Record<CategoriaCompraCodigo, string>;
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState<CategoriaCompraCodigo>("COMPRA");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorOpcionSelect | null>(null);
  const fecha = fechaLocalHoy();
  const [fechaEntrega, setFechaEntrega] = useState(fechaLocalManana());
  const [vigenteHasta, setVigenteHasta] = useState("");
  const [condicionPago, setCondicionPago] = useState<string>(CONDICIONES_PAGO[2]);
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [comentario, setComentario] = useState("");
  const [moneda, setMoneda] = useState<"PEN" | "USD">("PEN");
  const [enviando, setEnviando] = useState(false);
  const centroCostoInicial = centrosCosto[0] ?? "";
  const [filas, setFilas] = useState<FilaItem[]>([filaVacia(centroCostoInicial)]);

  const nombreDocumento = NOMBRE_ORDEN[categoria];
  const skusDeCategoria = skus.filter((s) => (categoria === "SERVICIO" ? s.categoria === "Servicios" : s.categoria !== "Servicios"));

  function cambiarCategoria(c: CategoriaCompraCodigo) {
    setCategoria(c);
    // El catálogo de SKU depende de la categoría (Servicios vs el resto) —
    // las líneas ya elegidas con el catálogo anterior ya no aplicarían.
    setFilas([filaVacia(centroCostoInicial)]);
  }

  function actualizarFila(index: number, cambios: Partial<FilaItem>) {
    setFilas((prev) => prev.map((f, i) => (i === index ? { ...f, ...cambios } : f)));
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia(centroCostoInicial)]);
  }

  function quitarFila(index: number) {
    setFilas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const subtotalesPorFila = filas.map((f) => Math.round((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0) * 100) / 100);
  const subtotal = subtotalesPorFila.reduce((a, b) => a + b, 0);
  const igv = filas.reduce((acc, f, i) => (f.gravado ? acc + subtotalesPorFila[i] * IGV_TASA : acc), 0);
  const igvRedondeado = Math.round(igv * 100) / 100;
  const total = Math.round((subtotal + igvRedondeado) * 100) / 100;

  async function handleSubmit() {
    if (!proveedorId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    if (!fechaEntrega) {
      toast.error("La fecha de entrega es obligatoria");
      return;
    }
    if (!lugarEntrega) {
      toast.error("Selecciona el lugar de entrega");
      return;
    }
    if (!comentario.trim()) {
      toast.error("El comentario es obligatorio");
      return;
    }
    if (tipoOrden === "ABIERTA" && !vigenteHasta) {
      toast.error("Selecciona el plazo de vigencia de la orden abierta");
      return;
    }
    for (const f of filas) {
      if (!f.skuId) {
        toast.error("Selecciona un producto en cada línea");
        return;
      }
      if ((Number(f.cantidad) || 0) <= 0) {
        toast.error(`La cantidad de ${f.codigo} debe ser mayor a 0`);
        return;
      }
      if (categoria === "SERVICIO" && !f.descripcion.trim()) {
        toast.error(`Describe el detalle del servicio de ${f.codigo}`);
        return;
      }
    }

    setEnviando(true);
    try {
      const resultado = await crearOrdenCompraDirectaAction({
        categoria,
        tipoOrden,
        vigenteHasta: tipoOrden === "ABIERTA" ? (new Date(vigenteHasta) as unknown as Date) : undefined,
        proveedorId,
        fecha: new Date(fecha) as unknown as Date,
        fechaEntrega: new Date(fechaEntrega) as unknown as Date,
        condicionPago: condicionPago as (typeof CONDICIONES_PAGO)[number],
        lugarEntrega: lugarEntrega as (typeof LUGARES_ENTREGA)[number],
        observaciones: comentario,
        moneda,
        items: filas.map((f) => ({
          skuId: f.skuId,
          cantidad: Number(f.cantidad),
          precioUnitario: Number(f.precioUnitario),
          gravado: f.gravado,
          centroCosto: f.centroCosto,
          descripcion: f.descripcion,
        })),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${nombreDocumento} registrada`);
      if (resultado?.id) {
        window.open(`/api/pdf/orden-compra/${resultado.id}`, "_blank");
        router.push(`/logistica/ordenes-compra/${resultado.id}`);
      } else {
        router.push("/logistica/ordenes-compra");
      }
    } catch (err) {
      console.error("Error al guardar la orden directa:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la orden — {numerosTentativos[categoria]}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoria} onValueChange={(v) => cambiarCategoria(v as CategoriaCompraCodigo)}>
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
            <p className="text-xs text-muted-foreground">Cambiarla vacía los productos ya elegidos.</p>
          </div>
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <ProveedorSelectCombobox
              proveedores={proveedores}
              value={proveedorId}
              onSelect={(p) => {
                setProveedorId(p?.id ?? "");
                setProveedorSeleccionado(p);
                setCondicionPago(p?.condicionPago ?? CONDICIONES_PAGO[2]);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ruc">RUC</Label>
            <Input id="ruc" disabled value={proveedorSeleccionado?.ruc || "—"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de emisión</Label>
            <Input id="fecha" type="date" readOnly className="cursor-not-allowed bg-muted opacity-70" value={fecha} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaEntrega">Fecha de entrega</Label>
            <Input
              id="fechaEntrega"
              type="date"
              required
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
            />
          </div>
          {tipoOrden === "ABIERTA" && (
            <div className="space-y-2">
              <Label htmlFor="vigenteHasta">Vigente hasta</Label>
              <Input
                id="vigenteHasta"
                type="date"
                required
                min={fecha}
                value={vigenteHasta}
                onChange={(e) => setVigenteHasta(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pasada esta fecha, la orden ya no admite más ingresos a almacén.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as "PEN" | "USD")}>
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
            <p className="text-xs text-muted-foreground">Toda la {nombreDocumento.toLowerCase()} se emite en una sola moneda.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condicionPago">Condición de pago</Label>
            <Select value={condicionPago} onValueChange={setCondicionPago}>
              <SelectTrigger id="condicionPago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDICIONES_PAGO.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se precarga del proveedor; cambiarla aquí no afecta su condición por defecto.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lugarEntrega">Lugar de entrega</Label>
            <Select value={lugarEntrega} onValueChange={setLugarEntrega}>
              <SelectTrigger id="lugarEntrega">
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                {LUGARES_ENTREGA.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="observaciones">Comentario</Label>
            <Textarea
              id="observaciones"
              rows={3}
              placeholder="Motivo de esta orden directa (por qué no pasó por una solicitud de pedido)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Productos de la orden</CardTitle>
            <p className="text-sm text-muted-foreground">
              Elige cualquier producto del catálogo de {categoria === "SERVICIO" ? "Servicios" : "Compra"}; esta orden no
              viene de ninguna solicitud de pedido.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={agregarFila}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  {categoria === "SERVICIO" && (
                    <TableHead className="min-w-[220px]">Descripción del servicio</TableHead>
                  )}
                  <TableHead className="w-24">Cantidad</TableHead>
                  <TableHead className="w-28">Precio unitario</TableHead>
                  <TableHead className="w-16">Gravado</TableHead>
                  <TableHead className="w-44">Centro de costo</TableHead>
                  <TableHead className="text-right w-24">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila, index) => (
                  <TableRow key={index}>
                    <TableCell className="align-top">
                      <Input disabled value={fila.codigo} />
                    </TableCell>
                    <TableCell className="align-top">
                      <SkuCombobox
                        skus={skusDeCategoria}
                        value={fila.skuId}
                        onSelect={(sku) =>
                          actualizarFila(index, {
                            skuId: sku.id,
                            codigo: sku.codigo,
                            descripcionSku: sku.descripcion,
                            unidadMedida: sku.unidadMedida,
                          })
                        }
                      />
                    </TableCell>
                    {categoria === "SERVICIO" && (
                      <TableCell className="align-top">
                        <Textarea
                          rows={2}
                          placeholder="Detalle y alcance del servicio"
                          value={fila.descripcion}
                          onChange={(e) => actualizarFila(index, { descripcion: e.target.value })}
                        />
                      </TableCell>
                    )}
                    <TableCell className="align-top">
                      <NumberInput value={fila.cantidad} onChange={(v) => actualizarFila(index, { cantidad: v })} />
                    </TableCell>
                    <TableCell className="align-top">
                      <NumberInput
                        value={fila.precioUnitario}
                        onChange={(v) => actualizarFila(index, { precioUnitario: v })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={fila.gravado}
                        onChange={(e) => actualizarFila(index, { gravado: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={fila.centroCosto} onValueChange={(v) => actualizarFila(index, { centroCosto: v })}>
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
                    </TableCell>
                    <TableCell className="text-right align-top pt-4 font-medium">
                      {formatMoneda(subtotalesPorFila[index] ?? 0, moneda)}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={filas.length === 1}
                        onClick={() => quitarFila(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Subtotal: <span className="font-medium">{formatMoneda(subtotal, moneda)}</span>
            </p>
            <p>
              IGV ({Math.round(IGV_TASA * 100)}%): <span className="font-medium">{formatMoneda(igvRedondeado, moneda)}</span>
            </p>
            <p className="text-base">
              Total: <span className="font-semibold text-primary">{formatMoneda(total, moneda)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleSubmit}>
          {enviando ? "Guardando..." : `Registrar ${nombreDocumento.toLowerCase()}`}
        </Button>
      </div>
    </div>
  );
}
