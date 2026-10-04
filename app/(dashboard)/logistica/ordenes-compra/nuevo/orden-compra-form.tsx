"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ProveedorSelectCombobox, type ProveedorOpcionSelect } from "@/components/shared/proveedor-select-combobox";
import { fechaLocalHoy, formatMoneda } from "@/lib/utils";
import { AREAS_EMPRESA, IGV_TASA, NOMBRE_ORDEN, NOMBRE_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { MONEDAS } from "@/lib/constants/moneda";
import { crearOrdenCompraAction } from "@/lib/actions/orden-compra-actions";
import type { SolicitudConPendientes } from "@/lib/compras";

type FilaSeleccion = {
  cantidad: string;
  precioUnitario: string;
  gravado: boolean;
  centroCosto: string;
  descripcion: string;
};

type ItemPlano = {
  id: string; // SolicitudPedidoItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  descripcionServicio: string | null;
  cantidadPendiente: number;
  unidadMedida: string;
  centroCosto: string;
  solicitudId: string;
  solicitudNumero: string;
  solicitudArea: string;
};

function filaVacia(item: ItemPlano): FilaSeleccion {
  return {
    cantidad: String(item.cantidadPendiente),
    precioUnitario: "0",
    gravado: true,
    centroCosto: item.centroCosto,
    descripcion: item.descripcionServicio ?? "",
  };
}

export function OrdenCompraForm({
  solicitudes,
  categoria,
  proveedores,
  solicitudIdInicial,
}: {
  solicitudes: SolicitudConPendientes[];
  categoria: CategoriaCompraCodigo;
  proveedores: ProveedorOpcionSelect[];
  /** Si se llega desde el botón "Generar OC/OS" de una solicitud puntual, sus ítems se precargan ya marcados. */
  solicitudIdInicial?: string;
}) {
  const nombreDocumento = NOMBRE_ORDEN[categoria];
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [condicionPago, setCondicionPago] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [moneda, setMoneda] = useState<"PEN" | "USD">("PEN");
  const [enviando, setEnviando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroSolped, setFiltroSolped] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroArea, setFiltroArea] = useState("");

  const itemsPlanos = useMemo<ItemPlano[]>(() => {
    const lista: ItemPlano[] = [];
    for (const solicitud of solicitudes) {
      for (const item of solicitud.items) {
        lista.push({
          id: item.id,
          skuId: item.skuId,
          codigo: item.codigo,
          descripcion: item.descripcion,
          descripcionServicio: item.descripcionServicio,
          cantidadPendiente: item.cantidadPendiente,
          unidadMedida: item.unidadMedida,
          centroCosto: item.centroCosto,
          solicitudId: solicitud.id,
          solicitudNumero: solicitud.numero,
          solicitudArea: solicitud.area,
        });
      }
    }
    return lista;
  }, [solicitudes]);

  const itemPorId = useMemo(() => new Map(itemsPlanos.map((item) => [item.id, item])), [itemsPlanos]);

  const [filas, setFilas] = useState<Record<string, FilaSeleccion>>(() => {
    const inicial: Record<string, FilaSeleccion> = {};
    if (solicitudIdInicial) {
      for (const item of itemsPlanos) {
        if (item.solicitudId === solicitudIdInicial) inicial[item.id] = filaVacia(item);
      }
    }
    return inicial;
  });

  function actualizarFila(itemId: string, cambios: Partial<FilaSeleccion>) {
    setFilas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...cambios } }));
  }

  function alternarItem(item: ItemPlano) {
    setFilas((prev) => {
      if (prev[item.id]) {
        const resto = { ...prev };
        delete resto[item.id];
        return resto;
      }
      return { ...prev, [item.id]: filaVacia(item) };
    });
  }

  function quitarItem(itemId: string) {
    setFilas((prev) => {
      const resto = { ...prev };
      delete resto[itemId];
      return resto;
    });
  }

  const itemsEnOrden = itemsPlanos.filter((item) => filas[item.id]);

  const subtotalesPorFila = new Map<string, number>();
  for (const item of itemsEnOrden) {
    const fila = filas[item.id];
    const cantidad = Number(fila.cantidad) || 0;
    const precio = Number(fila.precioUnitario) || 0;
    subtotalesPorFila.set(item.id, Math.round(cantidad * precio * 100) / 100);
  }

  const subtotal = [...subtotalesPorFila.values()].reduce((a, b) => a + b, 0);
  const igv = itemsEnOrden.reduce((acc, item) => {
    if (!filas[item.id].gravado) return acc;
    return acc + (subtotalesPorFila.get(item.id) ?? 0) * IGV_TASA;
  }, 0);
  const igvRedondeado = Math.round(igv * 100) / 100;
  const total = Math.round((subtotal + igvRedondeado) * 100) / 100;

  const itemsFiltrados = itemsPlanos.filter((item) => {
    if (filtroSolped && !item.solicitudNumero.toLowerCase().includes(filtroSolped.trim().toLowerCase())) return false;
    if (filtroProducto) {
      const texto = `${item.codigo} ${item.descripcion}`.toLowerCase();
      if (!texto.includes(filtroProducto.trim().toLowerCase())) return false;
    }
    if (filtroArea && item.centroCosto !== filtroArea) return false;
    return true;
  });

  async function handleSubmit() {
    if (!proveedorId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    if (itemsEnOrden.length === 0) {
      toast.error("Agrega al menos un producto con el botón 'Agregar producto'");
      return;
    }
    for (const item of itemsEnOrden) {
      const fila = filas[item.id];
      const cantidad = Number(fila.cantidad) || 0;
      if (cantidad <= 0) {
        toast.error(`La cantidad de ${item.codigo} debe ser mayor a 0`);
        return;
      }
      if (cantidad > item.cantidadPendiente) {
        toast.error(`La cantidad de ${item.codigo} no puede superar lo pendiente (${item.cantidadPendiente})`);
        return;
      }
    }

    setEnviando(true);
    try {
      const resultado = await crearOrdenCompraAction({
        proveedorId,
        fecha: new Date(fecha) as unknown as Date,
        fechaEntrega: fechaEntrega ? (new Date(fechaEntrega) as unknown as Date) : undefined,
        condicionPago,
        lugarEntrega,
        observaciones,
        moneda,
        items: itemsEnOrden.map((item) => {
          const fila = filas[item.id];
          return {
            solicitudPedidoItemId: item.id,
            skuId: item.skuId,
            cantidad: Number(fila.cantidad),
            precioUnitario: Number(fila.precioUnitario),
            gravado: fila.gravado,
            centroCosto: fila.centroCosto as (typeof AREAS_EMPRESA)[number]["valor"],
            descripcion: fila.descripcion,
          };
        }),
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
      console.error("Error al guardar la orden de compra:", err);
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
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaEntrega">Fecha de entrega (opcional)</Label>
            <Input id="fechaEntrega" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
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
            <p className="text-xs text-muted-foreground">Toda la {nombreDocumento.toLowerCase()} se emite en una sola moneda.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condicionPago">Condición de pago (opcional)</Label>
            <Input
              id="condicionPago"
              placeholder="Ej. Crédito 7 días, Contado"
              value={condicionPago}
              onChange={(e) => setCondicionPago(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lugarEntrega">Lugar de entrega (opcional)</Label>
            <Input
              id="lugarEntrega"
              placeholder="Ej. En fundo RPB"
              value={lugarEntrega}
              onChange={(e) => setLugarEntrega(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Productos de la orden</CardTitle>
            <p className="text-sm text-muted-foreground">
              La cantidad no puede superar lo pendiente de cada solicitud. Solo se pueden agregar ítems de solicitudes
              aprobadas de esta misma categoría.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setModalAbierto(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {itemsEnOrden.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has agregado productos. Usa el botón &quot;Agregar producto&quot; para buscar ítems pendientes por
              número de solicitud, producto o área.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead className="min-w-[180px]">Producto</TableHead>
                    {categoria === "SERVICIO" && (
                      <TableHead className="min-w-[220px]">Descripción del servicio</TableHead>
                    )}
                    <TableHead className="w-28">Solicitud</TableHead>
                    <TableHead className="text-right w-24">Pendiente</TableHead>
                    <TableHead className="w-24">Cantidad</TableHead>
                    <TableHead className="w-28">Precio unitario</TableHead>
                    <TableHead className="w-16">Gravado</TableHead>
                    <TableHead className="w-40">Centro de costo</TableHead>
                    <TableHead className="text-right w-24">Subtotal</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsEnOrden.map((item) => {
                    const fila = filas[item.id];
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium align-top">{item.codigo}</TableCell>
                        <TableCell className="align-top">{item.descripcion}</TableCell>
                        {categoria === "SERVICIO" && (
                          <TableCell className="align-top">
                            <Textarea
                              rows={2}
                              placeholder="Detalle y alcance del servicio"
                              value={fila.descripcion}
                              onChange={(e) => actualizarFila(item.id, { descripcion: e.target.value })}
                            />
                          </TableCell>
                        )}
                        <TableCell className="align-top">{item.solicitudNumero}</TableCell>
                        <TableCell className="text-right align-top">
                          {item.cantidadPendiente} {item.unidadMedida}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={0}
                            max={item.cantidadPendiente}
                            step="0.001"
                            value={fila.cantidad}
                            onChange={(e) => actualizarFila(item.id, { cantidad: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={fila.precioUnitario}
                            onChange={(e) => actualizarFila(item.id, { precioUnitario: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={fila.gravado}
                            onChange={(e) => actualizarFila(item.id, { gravado: e.target.checked })}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Select value={fila.centroCosto} onValueChange={(v) => actualizarFila(item.id, { centroCosto: v })}>
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
                        </TableCell>
                        <TableCell className="text-right align-top pt-4 font-medium">
                          {formatMoneda(subtotalesPorFila.get(item.id) ?? 0, moneda)}
                        </TableCell>
                        <TableCell className="align-top">
                          <Button type="button" variant="ghost" size="icon" onClick={() => quitarItem(item.id)}>
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

      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Agregar producto</DialogTitle>
            <DialogDescription>
              Busca ítems pendientes de {NOMBRE_SOLICITUD[categoria].toLowerCase()}s aprobadas por número de solicitud,
              producto o área, y marca los que quieras agregar a esta {nombreDocumento.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="filtroSolped">N.º de solicitud</Label>
              <Input
                id="filtroSolped"
                placeholder="Ej. SP-000000001"
                value={filtroSolped}
                onChange={(e) => setFiltroSolped(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filtroProducto">Producto</Label>
              <Input
                id="filtroProducto"
                placeholder="Código o descripción"
                value={filtroProducto}
                onChange={(e) => setFiltroProducto(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Área</Label>
              <Select value={filtroArea || "__todas__"} onValueChange={(v) => setFiltroArea(v === "__todas__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Todas las áreas</SelectItem>
                  {AREAS_EMPRESA.map((a) => (
                    <SelectItem key={a.valor} value={a.valor}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  <TableHead className="w-28">Solicitud</TableHead>
                  <TableHead className="w-32">Área</TableHead>
                  <TableHead className="text-right w-24">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      No se encontró ningún ítem pendiente con esos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsFiltrados.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => alternarItem(item)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!filas[item.id]}
                          onChange={() => alternarItem(item)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.codigo}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>{item.solicitudNumero}</TableCell>
                      <TableCell>{AREAS_EMPRESA.find((a) => a.valor === item.centroCosto)?.nombre ?? item.centroCosto}</TableCell>
                      <TableCell className="text-right">
                        {item.cantidadPendiente} {item.unidadMedida}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <p className="mr-auto self-center text-sm text-muted-foreground">
              {itemsEnOrden.length} producto{itemsEnOrden.length === 1 ? "" : "s"} agregado{itemsEnOrden.length === 1 ? "" : "s"}
            </p>
            <DialogClose asChild>
              <Button type="button">Listo</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
