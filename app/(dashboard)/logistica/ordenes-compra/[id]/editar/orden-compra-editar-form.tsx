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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ProveedorSelectCombobox, type ProveedorOpcionSelect } from "@/components/shared/proveedor-select-combobox";
import { SkuCombobox, type SkuOpcionCombobox } from "@/components/shared/sku-combobox";
import { formatMoneda } from "@/lib/utils";
import { CONDICIONES_PAGO, IGV_TASA, LUGARES_ENTREGA, NOMBRE_ORDEN, NOMBRE_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { MONEDAS } from "@/lib/constants/moneda";
import { editarOrdenCompraAction } from "@/lib/actions/orden-compra-actions";
import type { SolicitudConPendientes } from "@/lib/compras";

type ItemEditable = {
  id: string;
  codigo: string;
  descripcion: string;
  centroCosto: string;
};

type FilaEditable = {
  cantidad: string;
  precioUnitario: string;
  gravado: boolean;
  descripcion: string;
};

type SkuOpcion = SkuOpcionCombobox & { categoria: string };

// Una línea nueva (sin id todavía) agregada mientras se edita. tempId es
// solo para el key de React y para poder quitarla antes de guardar — no
// se manda al servidor.
type FilaNueva = {
  tempId: string;
  skuId: string;
  codigo: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  gravado: boolean;
  descripcionServicio: string;
  centroCosto: string;
  solicitudPedidoItemId?: string;
  cantidadPendiente?: number;
};

function nuevaFilaDesdeSku(sku: SkuOpcion, centroCostoInicial: string): FilaNueva {
  return {
    tempId: crypto.randomUUID(),
    skuId: sku.id,
    codigo: sku.codigo,
    descripcion: sku.descripcion,
    cantidad: "1",
    precioUnitario: "",
    gravado: true,
    descripcionServicio: "",
    centroCosto: centroCostoInicial,
  };
}

export function OrdenCompraEditarForm({
  ordenId,
  categoria,
  esDirecta,
  proveedores,
  items,
  skus,
  centrosCosto,
  solicitudesPendientes,
  valoresIniciales,
}: {
  ordenId: string;
  categoria: CategoriaCompraCodigo;
  esDirecta: boolean;
  proveedores: ProveedorOpcionSelect[];
  items: ItemEditable[];
  skus: SkuOpcion[];
  centrosCosto: string[];
  solicitudesPendientes: SolicitudConPendientes[];
  valoresIniciales: {
    proveedorId: string;
    fecha: string;
    fechaEntrega: string;
    condicionPago: string;
    lugarEntrega: string;
    observaciones: string;
    moneda: "PEN" | "USD";
    filas: Record<string, FilaEditable>;
  };
}) {
  const nombreDocumento = NOMBRE_ORDEN[categoria];
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState(valoresIniciales.proveedorId);
  // Fecha de emisión: se mantiene fija en la original, bloqueada -- no se
  // puede retrofechar ni adelantar una OC/OS, ni siquiera al editarla.
  const fecha = valoresIniciales.fecha;
  const [fechaEntrega, setFechaEntrega] = useState(valoresIniciales.fechaEntrega);
  const [condicionPago, setCondicionPago] = useState(valoresIniciales.condicionPago);
  const [lugarEntrega, setLugarEntrega] = useState(valoresIniciales.lugarEntrega);
  const [comentario, setComentario] = useState(valoresIniciales.observaciones);
  const [moneda, setMoneda] = useState<"PEN" | "USD">(valoresIniciales.moneda);
  const [enviando, setEnviando] = useState(false);
  const [filas, setFilas] = useState<Record<string, FilaEditable>>(valoresIniciales.filas);
  const [nuevasFilas, setNuevasFilas] = useState<FilaNueva[]>([]);
  const centroCostoInicial = centrosCosto[0] ?? "";

  // Solo para orden "Directa": catálogo de SKU según la categoría, igual
  // que al crearla.
  const skusDeCategoria = skus.filter((s) => (categoria === "SERVICIO" ? s.categoria === "Servicios" : s.categoria !== "Servicios"));

  // Solo para orden "Con Solped": buscador de ítems pendientes, igual que
  // al crearla (ver orden-compra-form.tsx).
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroSolped, setFiltroSolped] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const itemsPendientesPlanos = solicitudesPendientes.flatMap((s) =>
    s.items.map((item) => ({ ...item, solicitudNumero: s.numero }))
  );
  const itemsPendientesFiltrados = itemsPendientesPlanos.filter((item) => {
    if (filtroSolped && !item.solicitudNumero.toLowerCase().includes(filtroSolped.trim().toLowerCase())) return false;
    if (filtroProducto) {
      const texto = `${item.codigo} ${item.descripcion}`.toLowerCase();
      if (!texto.includes(filtroProducto.trim().toLowerCase())) return false;
    }
    return true;
  });

  function actualizarFila(itemId: string, cambios: Partial<FilaEditable>) {
    setFilas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...cambios } }));
  }

  function actualizarFilaNueva(tempId: string, cambios: Partial<FilaNueva>) {
    setNuevasFilas((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, ...cambios } : f)));
  }

  function quitarFilaNueva(tempId: string) {
    setNuevasFilas((prev) => prev.filter((f) => f.tempId !== tempId));
  }

  function agregarDesdeDirecta() {
    setNuevasFilas((prev) => [...prev, nuevaFilaDesdeSku({ id: "", codigo: "", descripcion: "", unidadMedida: "", categoria: "" }, centroCostoInicial)]);
  }

  function agregarDesdeSolped(item: (typeof itemsPendientesPlanos)[number]) {
    setNuevasFilas((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        skuId: item.skuId,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: String(item.cantidadPendiente),
        precioUnitario: "",
        gravado: true,
        descripcionServicio: item.descripcionServicio ?? "",
        centroCosto: item.centroCosto,
        solicitudPedidoItemId: item.id,
        cantidadPendiente: item.cantidadPendiente,
      },
    ]);
  }

  const subtotalesPorFila = new Map<string, number>();
  for (const item of items) {
    const fila = filas[item.id];
    const cantidad = Number(fila.cantidad) || 0;
    const precio = Number(fila.precioUnitario) || 0;
    subtotalesPorFila.set(item.id, Math.round(cantidad * precio * 100) / 100);
  }
  const subtotalesNuevos = nuevasFilas.map((f) => Math.round((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0) * 100) / 100);

  const subtotal = [...subtotalesPorFila.values()].reduce((a, b) => a + b, 0) + subtotalesNuevos.reduce((a, b) => a + b, 0);
  const igv =
    items.reduce((acc, item) => (filas[item.id].gravado ? acc + (subtotalesPorFila.get(item.id) ?? 0) * IGV_TASA : acc), 0) +
    nuevasFilas.reduce((acc, f, i) => (f.gravado ? acc + subtotalesNuevos[i] * IGV_TASA : acc), 0);
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
    for (const item of items) {
      const cantidad = Number(filas[item.id].cantidad) || 0;
      if (cantidad <= 0) {
        toast.error(`La cantidad de ${item.codigo} debe ser mayor a 0`);
        return;
      }
    }
    for (const f of nuevasFilas) {
      if (!f.skuId) {
        toast.error("Selecciona un producto en cada línea nueva");
        return;
      }
      if ((Number(f.cantidad) || 0) <= 0) {
        toast.error(`La cantidad de ${f.codigo} debe ser mayor a 0`);
        return;
      }
      if (f.cantidadPendiente !== undefined && Number(f.cantidad) > f.cantidadPendiente) {
        toast.error(`La cantidad de ${f.codigo} no puede superar lo pendiente (${f.cantidadPendiente})`);
        return;
      }
      if (categoria === "SERVICIO" && !f.descripcionServicio.trim()) {
        toast.error(`Describe el detalle del servicio de ${f.codigo}`);
        return;
      }
    }

    setEnviando(true);
    try {
      const resultado = await editarOrdenCompraAction(ordenId, {
        proveedorId,
        fecha: new Date(fecha) as unknown as Date,
        fechaEntrega: new Date(fechaEntrega) as unknown as Date,
        condicionPago: condicionPago as (typeof CONDICIONES_PAGO)[number],
        lugarEntrega: lugarEntrega as (typeof LUGARES_ENTREGA)[number],
        observaciones: comentario,
        moneda,
        items: [
          ...items.map((item) => {
            const fila = filas[item.id];
            return {
              id: item.id,
              cantidad: Number(fila.cantidad),
              precioUnitario: Number(fila.precioUnitario),
              gravado: fila.gravado,
              descripcion: fila.descripcion,
            };
          }),
          ...nuevasFilas.map((f) => ({
            skuId: f.skuId,
            centroCosto: f.centroCosto,
            solicitudPedidoItemId: f.solicitudPedidoItemId,
            cantidad: Number(f.cantidad),
            precioUnitario: Number(f.precioUnitario),
            gravado: f.gravado,
            descripcion: f.descripcionServicio,
          })),
        ],
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${nombreDocumento} actualizada`);
      router.push(`/logistica/ordenes-compra/${ordenId}`);
    } catch (err) {
      console.error("Error al editar la orden de compra:", err);
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
          <CardTitle className="text-base">Datos de la orden</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <ProveedorSelectCombobox proveedores={proveedores} value={proveedorId} onSelect={(p) => setProveedorId(p?.id ?? "")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de emisión</Label>
            <Input id="fecha" type="date" readOnly className="cursor-not-allowed bg-muted opacity-70" value={fecha} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaEntrega">Fecha de entrega</Label>
            <Input id="fechaEntrega" type="date" required value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
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
            <Textarea id="observaciones" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Productos de la orden</CardTitle>
            <p className="text-sm text-muted-foreground">
              Se puede editar cantidad, precio, gravado{categoria === "SERVICIO" ? " y descripción del servicio" : ""} de las
              líneas ya existentes, y agregar productos nuevos — pero no quitar los ya existentes.
            </p>
          </div>
          {esDirecta ? (
            <Button type="button" variant="outline" size="sm" onClick={agregarDesdeDirecta}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setModalAbierto(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  {categoria === "SERVICIO" && <TableHead className="min-w-[220px]">Descripción del servicio</TableHead>}
                  <TableHead>Centro de costo</TableHead>
                  <TableHead className="w-24">Cantidad</TableHead>
                  <TableHead className="w-28">Precio unitario</TableHead>
                  <TableHead className="w-16">Gravado</TableHead>
                  <TableHead className="text-right w-24">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const fila = filas[item.id];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium align-top">{item.codigo}</TableCell>
                      <TableCell className="align-top">{item.descripcion}</TableCell>
                      {categoria === "SERVICIO" && (
                        <TableCell className="align-top">
                          <Textarea
                            rows={2}
                            value={fila.descripcion}
                            onChange={(e) => actualizarFila(item.id, { descripcion: e.target.value })}
                          />
                        </TableCell>
                      )}
                      <TableCell className="align-top">{item.centroCosto}</TableCell>
                      <TableCell className="align-top">
                        <NumberInput value={fila.cantidad} onChange={(v) => actualizarFila(item.id, { cantidad: v })} />
                      </TableCell>
                      <TableCell className="align-top">
                        <NumberInput value={fila.precioUnitario} onChange={(v) => actualizarFila(item.id, { precioUnitario: v })} />
                      </TableCell>
                      <TableCell className="align-top">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={fila.gravado}
                          onChange={(e) => actualizarFila(item.id, { gravado: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right align-top pt-4 font-medium">
                        {formatMoneda(subtotalesPorFila.get(item.id) ?? 0, moneda)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
                {nuevasFilas.map((f, index) => (
                  <TableRow key={f.tempId} className="bg-accent/20">
                    <TableCell className="align-top">
                      {esDirecta ? (
                        <Input disabled value={f.codigo} />
                      ) : (
                        <span className="font-medium">{f.codigo}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {esDirecta ? (
                        <SkuCombobox
                          skus={skusDeCategoria}
                          value={f.skuId}
                          onSelect={(sku) =>
                            actualizarFilaNueva(f.tempId, { skuId: sku.id, codigo: sku.codigo, descripcion: sku.descripcion })
                          }
                        />
                      ) : (
                        f.descripcion
                      )}
                    </TableCell>
                    {categoria === "SERVICIO" && (
                      <TableCell className="align-top">
                        <Textarea
                          rows={2}
                          value={f.descripcionServicio}
                          onChange={(e) => actualizarFilaNueva(f.tempId, { descripcionServicio: e.target.value })}
                        />
                      </TableCell>
                    )}
                    <TableCell className="align-top">
                      {esDirecta ? (
                        <Select value={f.centroCosto} onValueChange={(v) => actualizarFilaNueva(f.tempId, { centroCosto: v })}>
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
                      ) : (
                        f.centroCosto
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <NumberInput value={f.cantidad} onChange={(v) => actualizarFilaNueva(f.tempId, { cantidad: v })} />
                      {f.cantidadPendiente !== undefined && (
                        <p className="mt-1 text-xs text-muted-foreground">Pendiente: {f.cantidadPendiente}</p>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <NumberInput value={f.precioUnitario} onChange={(v) => actualizarFilaNueva(f.tempId, { precioUnitario: v })} />
                    </TableCell>
                    <TableCell className="align-top">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={f.gravado}
                        onChange={(e) => actualizarFilaNueva(f.tempId, { gravado: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right align-top pt-4 font-medium">
                      {formatMoneda(subtotalesNuevos[index] ?? 0, moneda)}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button type="button" variant="ghost" size="icon" onClick={() => quitarFilaNueva(f.tempId)}>
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
          {enviando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {!esDirecta && (
        <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Agregar producto</DialogTitle>
              <DialogDescription>
                Busca ítems pendientes de {NOMBRE_SOLICITUD[categoria].toLowerCase()}s aprobadas y elige los que quieras
                agregar a esta {nombreDocumento.toLowerCase()}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="filtroSolped">N.º de solicitud</Label>
                <Input id="filtroSolped" placeholder="Ej. SP-000000001" value={filtroSolped} onChange={(e) => setFiltroSolped(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filtroProducto">Producto</Label>
                <Input id="filtroProducto" placeholder="Código o descripción" value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} />
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-[180px]">Producto</TableHead>
                    <TableHead className="w-28">Solicitud</TableHead>
                    <TableHead className="w-32">Centro de costo</TableHead>
                    <TableHead className="text-right w-24">Pendiente</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsPendientesFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No se encontró ningún ítem pendiente con esos filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemsPendientesFiltrados.map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => agregarDesdeSolped(item)}>
                        <TableCell className="font-medium">{item.codigo}</TableCell>
                        <TableCell>{item.descripcion}</TableCell>
                        <TableCell>{item.solicitudNumero}</TableCell>
                        <TableCell>{item.centroCosto}</TableCell>
                        <TableCell className="text-right">{item.cantidadPendiente}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button type="button" size="sm" variant="outline" onClick={() => agregarDesdeSolped(item)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">Listo</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
