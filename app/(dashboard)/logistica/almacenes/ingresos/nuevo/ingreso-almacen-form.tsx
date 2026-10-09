"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fechaLocalHoy, formatMoneda, formatCantidad } from "@/lib/utils";
import { convertirAUsd, TIPO_CAMBIO_PEN_USD } from "@/lib/constants/moneda";
import { actualizarIngresoAlmacenAction, subirGuiaRemisionIngresoAction } from "@/lib/actions/ingreso-almacen-actions";
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

// Esta vista es SOLO de edición: crear un ingreso nuevo usa el asistente
// de ingresos/nuevo/ingreso-almacen-wizard.tsx (selección de OC + ítems en
// pasos). Aquí el almacén y la OC ya están fijos; solo se ajustan
// cantidades, lote/fechas, la guía de remisión (número y archivo) y el
// flete.
export function IngresoAlmacenForm({
  almacen,
  edicion,
}: {
  almacen: AlmacenOpcion;
  edicion: {
    id: string;
    ordenCompra: OrdenCompraOpcion;
    fecha: string;
    guiaRemision: string;
    guiaRemisionArchivo: string;
    flete: string;
    observaciones: string;
    filas: Fila[];
  };
}) {
  const router = useRouter();

  const [fecha, setFecha] = useState(edicion.fecha);
  const [guiaRemision, setGuiaRemision] = useState(edicion.guiaRemision);
  const [archivoActual] = useState(edicion.guiaRemisionArchivo);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [flete, setFlete] = useState(edicion.flete);
  const [observaciones, setObservaciones] = useState(edicion.observaciones);
  const [filas, setFilas] = useState<Fila[]>(edicion.filas);
  const [enviando, setEnviando] = useState(false);

  const moneda = edicion.ordenCompra.moneda as "PEN" | "USD";
  const requiereLoteFecha = almacen.categoriaGeneral === "AGROQUIMICOS_FERTILIZANTES";
  const muestraLoteFecha = requiereLoteFecha || almacen.categoriaGeneral === "SUMINISTROS";

  function actualizarFila(ordenCompraItemId: string, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.id === ordenCompraItemId ? { ...f, ...cambios } : f)));
  }

  const filasActivas = filas.filter((f) => (Number(f.cantidad) || 0) > 0);
  const subtotales = filasActivas.map((f) => (Number(f.cantidad) || 0) * f.precioUnitario);
  const totalSubtotal = subtotales.reduce((a, b) => a + b, 0);
  const totalGeneral = totalSubtotal + (Number(flete) || 0);
  const totalGeneralUsd = convertirAUsd(totalGeneral, moneda);

  async function handleSubmit() {
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

    setEnviando(true);
    try {
      let guiaRemisionArchivo = archivoActual;
      if (archivoNuevo) {
        const subida = new FormData();
        subida.set("archivo", archivoNuevo);
        const subidaResultado = await subirGuiaRemisionIngresoAction(subida);
        if (subidaResultado.error || !subidaResultado.path) {
          toast.error(subidaResultado.error ?? "No se pudo subir la guía de remisión");
          return;
        }
        guiaRemisionArchivo = subidaResultado.path;
      }

      const payload: IngresoAlmacenInput = {
        fecha: new Date(fecha) as unknown as Date,
        ordenCompraId: edicion.ordenCompra.id,
        almacenId: almacen.id,
        guiaRemision,
        guiaRemisionArchivo,
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

      const resultado = await actualizarIngresoAlmacenAction(edicion.id, payload);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Ingreso actualizado");
      router.push(`/logistica/almacenes/ingresos/${resultado?.id ?? edicion.id}`);
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
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Input disabled value={almacen.nombre} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Orden de compra</Label>
            <Input disabled value={`${edicion.ordenCompra.numero} — ${edicion.ordenCompra.proveedorRazonSocial}`} />
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
            <NumberInput id="flete" value={flete} onChange={setFlete} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proveedor">Proveedor</Label>
            <Input id="proveedor" disabled value={edicion.ordenCompra.proveedorRazonSocial} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rucProveedor">RUC del proveedor</Label>
            <Input id="rucProveedor" disabled value={edicion.ordenCompra.proveedorRuc || "—"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moneda">Moneda (de la OC)</Label>
            <Input id="moneda" disabled value={moneda === "PEN" ? "Soles" : "Dólares"} />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="archivoGuia">Reemplazar guía de remisión (opcional)</Label>
            <div className="flex items-center gap-3">
              {archivoActual && (
                <a
                  href={`/api/almacenes/ingresos/${edicion.id}/guia`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Ver archivo actual
                </a>
              )}
              <Input
                id="archivoGuia"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setArchivoNuevo(e.target.files?.[0] ?? null)}
              />
            </div>
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
                  <TableHead className="w-28">Cant. a Ingresar</TableHead>
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
                    <TableCell className="text-right align-top pt-4">{formatCantidad(f.cantidadOc)}</TableCell>
                    <TableCell className="text-right align-top pt-4">{formatCantidad(f.cantidadPendiente)}</TableCell>
                    <TableCell className="align-top">
                      <NumberInput value={f.cantidad} onChange={(v) => actualizarFila(f.id, { cantidad: v })} />
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
          {enviando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
