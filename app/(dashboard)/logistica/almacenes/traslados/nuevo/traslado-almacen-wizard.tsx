"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SolicitudTrasladoPendienteCombobox,
  type SolicitudTrasladoPendienteOpcion,
} from "@/components/shared/solicitud-traslado-pendiente-combobox";
import { fechaLocalHoy } from "@/lib/utils";
import { crearTrasladoDesdeSolicitudAction } from "@/lib/actions/traslado-almacen-actions";
import type { TrasladoDesdeSolicitudInput } from "@/lib/validations/almacen";
import type { SolicitudTrasladoConPendientes, ItemSolicitudTrasladoPendiente } from "@/lib/stock-almacen";

type Fila = ItemSolicitudTrasladoPendiente & { cantidad: string };

export function TrasladoAlmacenWizard({
  solicitudes,
  solicitudIdInicial,
}: {
  solicitudes: SolicitudTrasladoConPendientes[];
  solicitudIdInicial?: string;
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);

  const [solicitudId, setSolicitudId] = useState(solicitudIdInicial ?? "");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const [filas, setFilas] = useState<Fila[]>([]);
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [guiaRemision, setGuiaRemision] = useState("");
  const [flete, setFlete] = useState("0");
  const [moneda, setMoneda] = useState<"PEN" | "USD">("PEN");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [resultado, setResultado] = useState<{ id: string; numero: string } | null>(null);

  const solicitud = solicitudes.find((s) => s.id === solicitudId);

  function seleccionarSolicitud(opcion: SolicitudTrasladoPendienteOpcion) {
    setSolicitudId(opcion.id);
    setSeleccionados(new Set());
  }

  function alternarItem(itemId: string) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(itemId)) siguiente.delete(itemId);
      else siguiente.add(itemId);
      return siguiente;
    });
  }

  function irAPaso2() {
    if (!solicitud || seleccionados.size === 0) {
      toast.error("Selecciona al menos un producto de la solicitud de traslado");
      return;
    }
    const items = solicitud.items.filter((i) => seleccionados.has(i.id));
    setFilas(items.map((item) => ({ ...item, cantidad: String(item.cantidadPendiente) })));
    setPaso(2);
  }

  function actualizarFila(itemId: string, cantidad: string) {
    setFilas((prev) => prev.map((f) => (f.id === itemId ? { ...f, cantidad } : f)));
  }

  async function handleRegistrar() {
    for (const f of filas) {
      const cantidad = Number(f.cantidad) || 0;
      if (cantidad <= 0 || cantidad > f.cantidadPendiente) {
        toast.error(`La cantidad a trasladar de ${f.codigo} debe ser mayor a 0 y no superar lo pendiente (${f.cantidadPendiente})`);
        return;
      }
    }

    setEnviando(true);
    try {
      const payload: TrasladoDesdeSolicitudInput = {
        solicitudTrasladoId: solicitudId,
        fecha: new Date(fecha) as unknown as Date,
        moneda,
        guiaRemision,
        flete: flete ? Number(flete) : null,
        observaciones,
        items: filas.map((f) => ({
          solicitudTrasladoItemId: f.id,
          skuId: f.skuId,
          cantidad: Number(f.cantidad),
          unidadMedida: f.unidadMedida,
        })),
      };
      const resultadoAccion = await crearTrasladoDesdeSolicitudAction(payload);
      if (resultadoAccion?.error || !resultadoAccion?.id) {
        toast.error(resultadoAccion?.error ?? "No se pudo registrar el traslado");
        return;
      }
      setResultado({ id: resultadoAccion.id, numero: solicitud!.numero });
      setPaso(3);
    } catch (err) {
      console.error("Error al registrar el traslado:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setEnviando(false);
    }
  }

  if (paso === 3 && resultado && solicitud) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traslado registrado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Origen</p>
              <p className="font-medium">{solicitud.almacenOrigenNombre}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Destino</p>
              <p className="font-medium">{solicitud.almacenDestinoNombre}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Solicitud de origen</p>
              <p className="font-medium">{solicitud.numero}</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad trasladada</TableHead>
                <TableHead>U.M.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.codigo}</TableCell>
                  <TableCell>{f.descripcion}</TableCell>
                  <TableCell className="text-right">{f.cantidad}</TableCell>
                  <TableCell>{f.unidadMedida}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href="/logistica/almacenes/traslados">Ver todos los traslados</Link>
            </Button>
            <Button asChild>
              <Link href={`/logistica/almacenes/traslados/${resultado.id}`}>Ver detalle completo</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paso === 2 && solicitud) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del traslado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Almacén origen</Label>
              <Input disabled value={solicitud.almacenOrigenNombre} />
            </div>
            <div className="space-y-2">
              <Label>Almacén destino</Label>
              <Input disabled value={solicitud.almacenDestinoNombre} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Moneda del flete</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as "PEN" | "USD")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">Soles</SelectItem>
                  <SelectItem value="USD">Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guiaRemision">N° de guía de remisión (opcional)</Label>
              <Input id="guiaRemision" value={guiaRemision} onChange={(e) => setGuiaRemision(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flete">Precio del flete (opcional)</Label>
              <Input id="flete" type="number" min={0} step="0.01" value={flete} onChange={(e) => setFlete(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="observaciones">Observaciones (opcional)</Label>
              <Textarea id="observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos seleccionados</CardTitle>
            <p className="text-sm text-muted-foreground">
              La cantidad a trasladar no puede superar lo pendiente de cada línea de la solicitud.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead className="min-w-[180px]">Producto</TableHead>
                    <TableHead className="w-16">U.M.</TableHead>
                    <TableHead className="text-right w-28">Solicitado</TableHead>
                    <TableHead className="text-right w-28">Pendiente</TableHead>
                    <TableHead className="w-32">Cant. a Trasladar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium align-top">{f.codigo}</TableCell>
                      <TableCell className="align-top">{f.descripcion}</TableCell>
                      <TableCell className="align-top">{f.unidadMedida}</TableCell>
                      <TableCell className="text-right align-top pt-4">{f.cantidadSolicitada}</TableCell>
                      <TableCell className="text-right align-top pt-4">{f.cantidadPendiente}</TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          min={0}
                          max={f.cantidadPendiente}
                          step="0.001"
                          value={f.cantidad}
                          onChange={(e) => actualizarFila(f.id, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setPaso(1)}>
            Atrás
          </Button>
          <Button type="button" disabled={enviando} onClick={handleRegistrar}>
            {enviando ? "Registrando..." : "Registrar Traslado"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Elige la solicitud de traslado y los productos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xl space-y-2">
            <Label>Solicitud de traslado (pendientes de ejecutar)</Label>
            <SolicitudTrasladoPendienteCombobox
              solicitudes={solicitudes.map((s) => ({
                id: s.id,
                numero: s.numero,
                almacenOrigenNombre: s.almacenOrigenNombre,
                almacenDestinoNombre: s.almacenDestinoNombre,
              }))}
              value={solicitudId}
              onSelect={seleccionarSolicitud}
            />
          </div>

          {solicitud ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead className="min-w-[180px]">Producto</TableHead>
                    <TableHead className="w-16">U.M.</TableHead>
                    <TableHead className="text-right w-28">Solicitado</TableHead>
                    <TableHead className="text-right w-28">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitud.items.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => alternarItem(item.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={seleccionados.has(item.id)}
                          onChange={() => alternarItem(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.codigo}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>{item.unidadMedida}</TableCell>
                      <TableCell className="text-right">{item.cantidadSolicitada}</TableCell>
                      <TableCell className="text-right">{item.cantidadPendiente}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona una solicitud de traslado para ver sus productos pendientes.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={irAPaso2}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
