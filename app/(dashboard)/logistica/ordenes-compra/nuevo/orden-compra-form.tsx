"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProveedorSelectCombobox, type ProveedorOpcionSelect } from "@/components/shared/proveedor-select-combobox";
import { fechaLocalHoy, formatMoneda } from "@/lib/utils";
import { AREAS_EMPRESA, IGV_TASA } from "@/lib/constants/compras";
import { MONEDAS } from "@/lib/constants/moneda";
import { crearOrdenCompraAction } from "@/lib/actions/orden-compra-actions";
import type { SolicitudConPendientes } from "@/lib/compras";

type FilaSeleccion = {
  incluido: boolean;
  cantidad: string;
  precioUnitario: string;
  gravado: boolean;
  centroCosto: string;
};

export function OrdenCompraForm({
  solicitudes,
  proveedores,
}: {
  solicitudes: SolicitudConPendientes[];
  proveedores: ProveedorOpcionSelect[];
}) {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [moneda, setMoneda] = useState<"PEN" | "USD">("PEN");
  const [enviando, setEnviando] = useState(false);

  const [filas, setFilas] = useState<Record<string, FilaSeleccion>>(() => {
    const inicial: Record<string, FilaSeleccion> = {};
    for (const solicitud of solicitudes) {
      for (const item of solicitud.items) {
        inicial[item.id] = {
          incluido: false,
          cantidad: String(item.cantidadPendiente),
          precioUnitario: "0",
          gravado: true,
          centroCosto: item.centroCosto,
        };
      }
    }
    return inicial;
  });

  function actualizarFila(itemId: string, cambios: Partial<FilaSeleccion>) {
    setFilas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...cambios } }));
  }

  const itemPorId = useMemo(() => {
    const mapa = new Map<string, { skuId: string; codigo: string; descripcion: string; cantidadPendiente: number; unidadMedida: string }>();
    for (const solicitud of solicitudes) {
      for (const item of solicitud.items) {
        mapa.set(item.id, item);
      }
    }
    return mapa;
  }, [solicitudes]);

  const subtotalesPorFila = new Map<string, number>();
  for (const [itemId, fila] of Object.entries(filas)) {
    if (!fila.incluido) continue;
    const cantidad = Number(fila.cantidad) || 0;
    const precio = Number(fila.precioUnitario) || 0;
    subtotalesPorFila.set(itemId, Math.round(cantidad * precio * 100) / 100);
  }

  const subtotal = [...subtotalesPorFila.values()].reduce((a, b) => a + b, 0);
  const igv = Object.entries(filas).reduce((acc, [itemId, fila]) => {
    if (!fila.incluido || !fila.gravado) return acc;
    return acc + (subtotalesPorFila.get(itemId) ?? 0) * IGV_TASA;
  }, 0);
  const igvRedondeado = Math.round(igv * 100) / 100;
  const total = Math.round((subtotal + igvRedondeado) * 100) / 100;

  const itemsSeleccionados = Object.entries(filas).filter(([, fila]) => fila.incluido);

  async function handleSubmit() {
    if (!proveedorId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    if (itemsSeleccionados.length === 0) {
      toast.error("Selecciona al menos un ítem pendiente");
      return;
    }
    for (const [itemId, fila] of itemsSeleccionados) {
      const item = itemPorId.get(itemId);
      if (!item) continue;
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
        moneda,
        items: itemsSeleccionados.map(([itemId, fila]) => {
          const item = itemPorId.get(itemId)!;
          return {
            solicitudPedidoItemId: itemId,
            skuId: item.skuId,
            cantidad: Number(fila.cantidad),
            precioUnitario: Number(fila.precioUnitario),
            gravado: fila.gravado,
            centroCosto: fila.centroCosto as (typeof AREAS_EMPRESA)[number]["valor"],
          };
        }),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Orden de compra registrada");
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
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
            <p className="text-xs text-muted-foreground">Toda la orden se emite en una sola moneda.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ítems pendientes de solicitudes de pedido</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecciona los ítems a incluir en esta orden. La cantidad no puede superar lo pendiente de cada solicitud,
            y el centro de costo se precarga desde la solicitud pero puede cambiarse aquí.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {solicitudes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ítems pendientes en ninguna solicitud de pedido.</p>
          ) : (
            solicitudes.map((solicitud) => (
              <div key={solicitud.id} className="space-y-2">
                <p className="text-sm font-medium">
                  Solicitud {solicitud.numero} — {AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area}
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-28">Código</TableHead>
                        <TableHead className="min-w-[200px]">Producto</TableHead>
                        <TableHead className="text-right w-28">Pendiente</TableHead>
                        <TableHead className="w-28">Cantidad</TableHead>
                        <TableHead className="w-32">Precio unitario</TableHead>
                        <TableHead className="w-20">Gravado</TableHead>
                        <TableHead className="w-44">Centro de costo</TableHead>
                        <TableHead className="text-right w-28">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {solicitud.items.map((item) => {
                        const fila = filas[item.id];
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={fila.incluido}
                                onChange={(e) => actualizarFila(item.id, { incluido: e.target.checked })}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.codigo}</TableCell>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell className="text-right">
                              {item.cantidadPendiente} {item.unidadMedida}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={item.cantidadPendiente}
                                step="0.001"
                                disabled={!fila.incluido}
                                value={fila.cantidad}
                                onChange={(e) => actualizarFila(item.id, { cantidad: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                disabled={!fila.incluido}
                                value={fila.precioUnitario}
                                onChange={(e) => actualizarFila(item.id, { precioUnitario: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                disabled={!fila.incluido}
                                checked={fila.gravado}
                                onChange={(e) => actualizarFila(item.id, { gravado: e.target.checked })}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={fila.centroCosto}
                                onValueChange={(v) => actualizarFila(item.id, { centroCosto: v })}
                                disabled={!fila.incluido}
                              >
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
                            <TableCell className="text-right font-medium">
                              {fila.incluido ? formatMoneda(subtotalesPorFila.get(item.id) ?? 0, moneda) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Subtotal: <span className="font-medium">{formatMoneda(subtotal, moneda)}</span>
            </p>
            <p>
              IGV ({Math.round(IGV_TASA * 100)}%): <span className="font-medium">{formatMoneda(igvRedondeado, moneda)}</span>
            </p>
            <p className="text-base">
              Total compra: <span className="font-semibold text-primary">{formatMoneda(total, moneda)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleSubmit}>
          {enviando ? "Guardando..." : "Registrar orden de compra"}
        </Button>
      </div>
    </div>
  );
}
