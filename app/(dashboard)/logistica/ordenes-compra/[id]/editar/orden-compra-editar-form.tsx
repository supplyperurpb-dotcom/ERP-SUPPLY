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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProveedorSelectCombobox, type ProveedorOpcionSelect } from "@/components/shared/proveedor-select-combobox";
import { formatMoneda } from "@/lib/utils";
import { CONDICIONES_PAGO, IGV_TASA, LUGARES_ENTREGA, NOMBRE_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { MONEDAS } from "@/lib/constants/moneda";
import { editarOrdenCompraAction } from "@/lib/actions/orden-compra-actions";

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

// Edita los datos generales y las líneas YA EXISTENTES de una OC/OS en
// BORRADOR (editarOrdenCompraAction no deja agregar ni quitar líneas acá
// — para eso se anula y se genera una nueva desde la Solped). centroCosto
// se muestra fijo, igual que al crear (ver orden-compra-form.tsx).
export function OrdenCompraEditarForm({
  ordenId,
  categoria,
  proveedores,
  items,
  valoresIniciales,
}: {
  ordenId: string;
  categoria: CategoriaCompraCodigo;
  proveedores: ProveedorOpcionSelect[];
  items: ItemEditable[];
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

  function actualizarFila(itemId: string, cambios: Partial<FilaEditable>) {
    setFilas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...cambios } }));
  }

  const subtotalesPorFila = new Map<string, number>();
  for (const item of items) {
    const fila = filas[item.id];
    const cantidad = Number(fila.cantidad) || 0;
    const precio = Number(fila.precioUnitario) || 0;
    subtotalesPorFila.set(item.id, Math.round(cantidad * precio * 100) / 100);
  }
  const subtotal = [...subtotalesPorFila.values()].reduce((a, b) => a + b, 0);
  const igv = items.reduce((acc, item) => {
    if (!filas[item.id].gravado) return acc;
    return acc + (subtotalesPorFila.get(item.id) ?? 0) * IGV_TASA;
  }, 0);
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
        items: items.map((item) => {
          const fila = filas[item.id];
          return {
            id: item.id,
            cantidad: Number(fila.cantidad),
            precioUnitario: Number(fila.precioUnitario),
            gravado: fila.gravado,
            descripcion: fila.descripcion,
          };
        }),
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
        <CardHeader>
          <CardTitle className="text-base">Productos de la orden</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solo se puede editar cantidad, precio, gravado{categoria === "SERVICIO" ? " y descripción del servicio" : ""} de
            las líneas ya existentes — no se pueden agregar ni quitar productos acá.
          </p>
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
                    </TableRow>
                  );
                })}
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
    </div>
  );
}
