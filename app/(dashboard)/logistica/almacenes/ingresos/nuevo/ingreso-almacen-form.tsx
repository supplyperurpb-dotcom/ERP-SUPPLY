"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  OrdenCompraPendienteCombobox,
  type OrdenCompraPendienteOpcion,
} from "@/components/shared/orden-compra-pendiente-combobox";
import { fechaLocalHoy, formatMoneda } from "@/lib/utils";
import { convertirAUsd, TIPO_CAMBIO_PEN_USD } from "@/lib/constants/moneda";
import { crearIngresoAlmacenAction, actualizarIngresoAlmacenAction } from "@/lib/actions/ingreso-almacen-actions";
import type { IngresoAlmacenInput } from "@/lib/validations/almacen";

export type AlmacenOpcion = { id: string; nombre: string; categoriaGeneral: string | null };
export type ItemOc = {
  id: string; // OrdenCompraItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  precioUnitario: number;
  cantidadOc: number;
  cantidadPendiente: number;
};
export type OrdenCompraOpcion = {
  id: string;
  numero: string;
  moneda: string;
  proveedorRazonSocial: string;
  proveedorRuc: string;
  items: ItemOc[];
};

type Fila = ItemOc & {
  cantidad: string;
  lote: string;
  fechaProduccion: string;
  fechaVencimiento: string;
};

function filaDesdeItemOc(item: ItemOc, cantidadInicial?: number, lote = "", fechaProduccion = "", fechaVencimiento = ""): Fila {
  return {
    ...item,
    cantidad: String(cantidadInicial ?? item.cantidadPendiente),
    lote,
    fechaProduccion,
    fechaVencimiento,
  };
}

export function IngresoAlmacenForm({
  almacenes,
  ordenesCompra,
  almacenIdInicial,
  edicion,
}: {
  almacenes: AlmacenOpcion[];
  ordenesCompra: OrdenCompraOpcion[];
  almacenIdInicial?: string;
  /** Presente solo al editar: la OC ya resuelta (con lo pendiente ajustado para incluir lo que este mismo ingreso ya tomó) y las filas precargadas. */
  edicion?: {
    id: string;
    almacenId: string;
    ordenCompra: OrdenCompraOpcion;
    fecha: string;
    guiaRemision: string;
    flete: string;
    observaciones: string;
    filas: Fila[];
  };
}) {
  const router = useRouter();
  const esEdicion = !!edicion;

  const [almacenId, setAlmacenId] = useState(edicion?.almacenId ?? almacenIdInicial ?? "");
  const [ordenCompraId, setOrdenCompraId] = useState(edicion?.ordenCompra.id ?? "");
  const [fecha, setFecha] = useState(edicion?.fecha ?? fechaLocalHoy());
  const [guiaRemision, setGuiaRemision] = useState(edicion?.guiaRemision ?? "");
  const [flete, setFlete] = useState(edicion?.flete ?? "0");
  const [observaciones, setObservaciones] = useState(edicion?.observaciones ?? "");
  const [filas, setFilas] = useState<Fila[]>(edicion?.filas ?? []);
  const [enviando, setEnviando] = useState(false);

  const almacen = almacenes.find((a) => a.id === almacenId);
  const ordenSeleccionada = esEdicion ? edicion!.ordenCompra : ordenesCompra.find((o) => o.id === ordenCompraId);
  const moneda = (ordenSeleccionada?.moneda ?? "PEN") as "PEN" | "USD";

  const requiereLoteFecha = almacen?.categoriaGeneral === "AGROQUIMICOS_FERTILIZANTES";
  const muestraLoteFecha = requiereLoteFecha || almacen?.categoriaGeneral === "SUMINISTROS";

  function seleccionarOrden(orden: OrdenCompraPendienteOpcion) {
    const completa = ordenesCompra.find((o) => o.id === orden.id);
    if (!completa) return;
    setOrdenCompraId(orden.id);
    setFilas(completa.items.map((item) => filaDesdeItemOc(item)));
  }

  function actualizarFila(ordenCompraItemId: string, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.id === ordenCompraItemId ? { ...f, ...cambios } : f)));
  }

  const filasActivas = filas.filter((f) => (Number(f.cantidad) || 0) > 0);
  const subtotales = filasActivas.map((f) => (Number(f.cantidad) || 0) * f.precioUnitario);
  const totalSubtotal = subtotales.reduce((a, b) => a + b, 0);
  const totalGeneral = totalSubtotal + (Number(flete) || 0);
  const totalGeneralUsd = convertirAUsd(totalGeneral, moneda);

  async function handleSubmit() {
    if (!almacenId) {
      toast.error("Selecciona el almacén");
      return;
    }
    if (!ordenCompraId) {
      toast.error("Selecciona una orden de compra");
      return;
    }
    if (filasActivas.length === 0) {
      toast.error("Ingresa una cantidad mayor a 0 en al menos un producto");
      return;
    }
    for (const f of filasActivas) {
      const cantidad = Number(f.cantidad) || 0;
      if (cantidad > f.cantidadPendiente) {
        toast.error(`La cantidad de ${f.codigo} no puede superar lo pendiente (${f.cantidadPendiente})`);
        return;
      }
      if (requiereLoteFecha && (!f.lote.trim() || !f.fechaProduccion || !f.fechaVencimiento)) {
        toast.error(`${f.codigo}: lote, fecha de producción y fecha de vencimiento son obligatorios en este almacén`);
        return;
      }
    }

    const payload: IngresoAlmacenInput = {
      fecha: new Date(fecha) as unknown as Date,
      ordenCompraId,
      almacenId,
      guiaRemision,
      flete: flete ? Number(flete) : null,
      observaciones,
      items: filasActivas.map((f) => ({
        ordenCompraItemId: f.id,
        skuId: f.skuId,
        cantidad: Number(f.cantidad),
        unidadMedida: f.unidadMedida,
        lote: f.lote,
        fechaProduccion: f.fechaProduccion ? (new Date(f.fechaProduccion) as unknown as Date) : undefined,
        fechaVencimiento: f.fechaVencimiento ? (new Date(f.fechaVencimiento) as unknown as Date) : undefined,
      })),
    };

    setEnviando(true);
    try {
      const resultado = esEdicion
        ? await actualizarIngresoAlmacenAction(edicion!.id, payload)
        : await crearIngresoAlmacenAction(payload);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(esEdicion ? "Ingreso actualizado" : "Ingreso registrado");
      router.push(resultado?.id ? `/logistica/almacenes/ingresos/${resultado.id}` : "/logistica/almacenes/ingresos");
    } catch (err) {
      console.error("Error al guardar el ingreso a almacén:", err);
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
          <CardTitle className="text-base">Datos del ingreso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Los ingresos solo se registran en un almacén general; para repartirlo a un sub-almacén, usa un traslado
            después.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Select value={almacenId} onValueChange={setAlmacenId} disabled={esEdicion}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un almacén general" />
              </SelectTrigger>
              <SelectContent>
                {almacenes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Orden de compra</Label>
            {esEdicion ? (
              <Input disabled value={`${edicion!.ordenCompra.numero} — ${edicion!.ordenCompra.proveedorRazonSocial}`} />
            ) : (
              <OrdenCompraPendienteCombobox
                ordenes={ordenesCompra.map((o) => ({ id: o.id, numero: o.numero, proveedorRazonSocial: o.proveedorRazonSocial }))}
                value={ordenCompraId}
                onSelect={seleccionarOrden}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de recepción</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guiaRemision">N° de guía de remisión (opcional)</Label>
            <Input id="guiaRemision" value={guiaRemision} onChange={(e) => setGuiaRemision(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flete">Precio del flete (opcional)</Label>
            <Input id="flete" type="number" min={0} step="0.01" value={flete} onChange={(e) => setFlete(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proveedor">Proveedor</Label>
            <Input id="proveedor" disabled value={ordenSeleccionada?.proveedorRazonSocial ?? "—"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rucProveedor">RUC del proveedor</Label>
            <Input id="rucProveedor" disabled value={ordenSeleccionada?.proveedorRuc ?? "—"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moneda">Moneda (de la OC)</Label>
            <Input id="moneda" disabled value={ordenSeleccionada ? (moneda === "PEN" ? "Soles" : "Dólares") : "—"} />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
          <p className="text-sm text-muted-foreground">
            La cantidad a ingresar no puede superar lo pendiente de cada línea de la OC. Deja en 0 lo que no vas a
            recibir en este ingreso.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {filas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {esEdicion ? "Este ingreso no tiene productos." : "Selecciona una orden de compra para ver sus productos pendientes."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead className="min-w-[180px]">Producto</TableHead>
                    <TableHead className="w-16">U.M.</TableHead>
                    <TableHead className="text-right w-24">Precio</TableHead>
                    <TableHead className="text-right w-24">Cant. OC</TableHead>
                    <TableHead className="text-right w-24">Pendiente</TableHead>
                    <TableHead className="w-28">Cant. a ingresar</TableHead>
                    {muestraLoteFecha && (
                      <>
                        <TableHead className="w-28">Lote{requiereLoteFecha ? " *" : ""}</TableHead>
                        <TableHead className="w-36">F. producción{requiereLoteFecha ? " *" : ""}</TableHead>
                        <TableHead className="w-36">F. vencimiento{requiereLoteFecha ? " *" : ""}</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium align-top">{f.codigo}</TableCell>
                      <TableCell className="align-top">{f.descripcion}</TableCell>
                      <TableCell className="align-top">{f.unidadMedida}</TableCell>
                      <TableCell className="text-right align-top pt-4">{formatMoneda(f.precioUnitario, moneda)}</TableCell>
                      <TableCell className="text-right align-top pt-4">{f.cantidadOc}</TableCell>
                      <TableCell className="text-right align-top pt-4">{f.cantidadPendiente}</TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          min={0}
                          max={f.cantidadPendiente}
                          step="0.001"
                          value={f.cantidad}
                          onChange={(e) => actualizarFila(f.id, { cantidad: e.target.value })}
                        />
                      </TableCell>
                      {muestraLoteFecha && (
                        <>
                          <TableCell className="align-top">
                            <Input value={f.lote} onChange={(e) => actualizarFila(f.id, { lote: e.target.value })} />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="date"
                              value={f.fechaProduccion}
                              onChange={(e) => actualizarFila(f.id, { fechaProduccion: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="date"
                              value={f.fechaVencimiento}
                              onChange={(e) => actualizarFila(f.id, { fechaVencimiento: e.target.value })}
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Subtotal productos: <span className="font-medium">{formatMoneda(totalSubtotal, moneda)}</span>
            </p>
            <p>
              Flete: <span className="font-medium">{formatMoneda(Number(flete) || 0, moneda)}</span>
            </p>
            <p className="text-base">
              Total: <span className="font-semibold text-primary">{formatMoneda(totalGeneral, moneda)}</span>
            </p>
            {moneda === "PEN" && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatMoneda(totalGeneralUsd, "USD")} (tipo de cambio fijo S/ {TIPO_CAMBIO_PEN_USD.toFixed(2)})
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleSubmit}>
          {enviando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Registrar ingreso"}
        </Button>
      </div>
    </div>
  );
}
