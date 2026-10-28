"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  OrdenCompraPendienteCombobox,
  type OrdenCompraPendienteOpcion,
} from "@/components/shared/orden-compra-pendiente-combobox";
import { fechaLocalHoy, formatMoneda, formatCantidad } from "@/lib/utils";
import { convertirAUsd, TIPO_CAMBIO_PEN_USD } from "@/lib/constants/moneda";
import { crearIngresoAlmacenAction, subirGuiaRemisionIngresoAction } from "@/lib/actions/ingreso-almacen-actions";
import type { IngresoAlmacenInput } from "@/lib/validations/almacen";
import type { AlmacenOpcion, ItemOc, OrdenCompraOpcion } from "./ingreso-almacen-form";

type Fila = ItemOc & {
  cantidad: string;
  lote: string;
  fechaProduccion: string;
  fechaVencimiento: string;
};

export function IngresoAlmacenWizard({
  titulo,
  descripcion,
  usuario,
  almacenes,
  ordenesCompra,
  almacenIdInicial,
}: {
  titulo: string;
  descripcion: string;
  usuario: { nombres: string; apellidos: string };
  almacenes: AlmacenOpcion[];
  ordenesCompra: OrdenCompraOpcion[];
  almacenIdInicial?: string;
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);

  // Paso 1: elegir almacén + OC, y marcar qué ítems se van a ingresar. El
  // almacén se bloquea apenas se elige (o si ya llegó preseleccionado desde
  // el diálogo "Nuevo Movimiento") — "Anterior" lo vuelve a dejar editable.
  const [almacenId, setAlmacenId] = useState(almacenIdInicial ?? "");
  const [almacenBloqueado, setAlmacenBloqueado] = useState(!!almacenIdInicial);
  const [ordenCompraId, setOrdenCompraId] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // Paso 2: datos del ingreso + cantidades/lote por línea seleccionada.
  const [filas, setFilas] = useState<Fila[]>([]);
  // Fecha de ingreso: siempre hoy, bloqueada — igual que la fecha de
  // emisión de una OC/Solped. Fecha de contabilización sí es editable,
  // pero nunca posterior a hoy (ver ingresoAlmacenSchema).
  const fecha = fechaLocalHoy();
  const [fechaContabilizacion, setFechaContabilizacion] = useState(fechaLocalHoy());
  const [guiaRemision, setGuiaRemision] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Paso 3: resumen de lo registrado.
  const [resultado, setResultado] = useState<{ id: string; numero: string } | null>(null);

  const almacen = almacenes.find((a) => a.id === almacenId);
  const ordenSeleccionada = ordenesCompra.find((o) => o.id === ordenCompraId);
  const moneda = (ordenSeleccionada?.moneda ?? "PEN") as "PEN" | "USD";
  const requierePorAlmacen = almacen?.categoriaGeneral === "PESTICIDAS" || almacen?.categoriaGeneral === "FERTILIZANTES";
  const muestraLoteFecha = requierePorAlmacen || almacen?.categoriaGeneral === "SUMINISTROS" || filas.some((f) => f.skuRequiereLote);

  function seleccionarOrden(orden: OrdenCompraPendienteOpcion) {
    setOrdenCompraId(orden.id);
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
    if (!almacenId) {
      toast.error("Selecciona el almacén");
      return;
    }
    if (!ordenSeleccionada || seleccionados.size === 0) {
      toast.error("Selecciona al menos un producto de la orden de compra");
      return;
    }
    const items = ordenSeleccionada.items.filter((i) => seleccionados.has(i.id));
    setFilas(
      items.map((item) => ({
        ...item,
        cantidad: String(item.cantidadPendiente),
        lote: "",
        fechaProduccion: "",
        fechaVencimiento: "",
      }))
    );
    setPaso(2);
  }

  function actualizarFila(itemId: string, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.id === itemId ? { ...f, ...cambios } : f)));
  }

  const subtotales = filas.map((f) => (Number(f.cantidad) || 0) * f.precioUnitario);
  const totalGeneral = subtotales.reduce((a, b) => a + b, 0);
  const totalGeneralUsd = convertirAUsd(totalGeneral, moneda);

  async function handleRegistrar() {
    if (!guiaRemision.trim()) {
      toast.error("El número de guía de remisión es obligatorio");
      return;
    }
    if (!fechaContabilizacion) {
      toast.error("La fecha de contabilización es obligatoria");
      return;
    }
    if (fechaContabilizacion > fechaLocalHoy()) {
      toast.error("La fecha de contabilización no puede ser posterior a hoy");
      return;
    }
    for (const f of filas) {
      const cantidad = Number(f.cantidad) || 0;
      if (cantidad <= 0 || cantidad > f.cantidadPendiente) {
        toast.error(`La cantidad a ingresar de ${f.codigo} debe ser mayor a 0 y no superar lo pendiente de la OC (${f.cantidadPendiente})`);
        return;
      }
      if (requierePorAlmacen || f.skuRequiereLote) {
        if (!f.lote.trim()) {
          toast.error(`Al código ${f.codigo} no se le ha registrado Lote`);
          return;
        }
        if (!f.fechaProduccion) {
          toast.error(`Al código ${f.codigo} no se le ha registrado Fecha de Producción`);
          return;
        }
        if (!f.fechaVencimiento) {
          toast.error(`Al código ${f.codigo} no se le ha registrado Fecha de Vencimiento`);
          return;
        }
      }
    }
    if (!archivo) {
      toast.error("Adjunta la guía de remisión (foto o PDF)");
      return;
    }

    setEnviando(true);
    try {
      const subida = new FormData();
      subida.set("archivo", archivo);
      const subidaResultado = await subirGuiaRemisionIngresoAction(subida);
      if (subidaResultado.error || !subidaResultado.path) {
        toast.error(subidaResultado.error ?? "No se pudo subir la guía de remisión");
        return;
      }

      const payload: IngresoAlmacenInput = {
        fecha: new Date(fecha) as unknown as Date,
        fechaContabilizacion: new Date(fechaContabilizacion) as unknown as Date,
        ordenCompraId,
        almacenId,
        guiaRemision,
        guiaRemisionArchivo: subidaResultado.path,
        observaciones,
        items: filas.map((f) => ({
          ordenCompraItemId: f.id,
          skuId: f.skuId,
          cantidad: Number(f.cantidad),
          unidadMedida: f.unidadMedida,
          lote: f.lote,
          fechaProduccion: f.fechaProduccion ? (new Date(f.fechaProduccion) as unknown as Date) : undefined,
          fechaVencimiento: f.fechaVencimiento ? (new Date(f.fechaVencimiento) as unknown as Date) : undefined,
        })),
      };

      const resultadoAccion = await crearIngresoAlmacenAction(payload);
      if (resultadoAccion?.error || !resultadoAccion?.id || !resultadoAccion?.numero) {
        toast.error(resultadoAccion?.error ?? "No se pudo registrar el ingreso");
        return;
      }
      setResultado({ id: resultadoAccion.id, numero: resultadoAccion.numero });
      setPaso(3);
    } catch (err) {
      console.error("Error al registrar el ingreso a almacén:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setEnviando(false);
    }
  }

  function registrarOtro() {
    setPaso(1);
    setOrdenCompraId("");
    setSeleccionados(new Set());
    setFilas([]);
    setFechaContabilizacion(fechaLocalHoy());
    setGuiaRemision("");
    setArchivo(null);
    setObservaciones("");
    setResultado(null);
  }

  // Paso 1: "Anterior" (vuelve a dejar el almacén editable) y "Siguiente"
  // (pasa al paso 2) van juntos arriba a la derecha, a la altura del
  // título — no al costado del campo Almacén ni al pie de la tarjeta.
  const accionesPaso1 = (
    <>
      {almacenBloqueado && (
        <Button type="button" variant="outline" onClick={() => setAlmacenBloqueado(false)}>
          Anterior
        </Button>
      )}
      <Button type="button" onClick={irAPaso2}>
        Siguiente
      </Button>
    </>
  );

  if (paso === 3 && resultado) {
    return (
      <div className="space-y-6">
        <PageHeader titulo={titulo} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingreso {resultado.numero} registrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Almacén</p>
              <p className="font-medium">{almacen?.nombre}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Orden de compra</p>
              <p className="font-medium">{ordenSeleccionada?.numero}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha de ingreso</p>
              <p className="font-medium">{fecha}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Registrado por</p>
              <p className="font-medium">
                {usuario.nombres} {usuario.apellidos}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad ingresada</TableHead>
                <TableHead>U.M.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.codigo}</TableCell>
                  <TableCell>{f.descripcion}</TableCell>
                  <TableCell className="text-right">{formatCantidad(f.cantidad)}</TableCell>
                  <TableCell>{f.unidadMedida}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={registrarOtro}>
              Registrar otro ingreso
            </Button>
            <Button asChild>
              <Link href={`/logistica/almacenes/ingresos/${resultado.id}`}>Ver detalle completo</Link>
            </Button>
          </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paso === 2) {
    return (
      <div className="space-y-6">
        <PageHeader titulo={titulo} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del ingreso</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Almacén</Label>
              <Input disabled value={almacen?.nombre ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Orden de compra</Label>
              <Input disabled value={`${ordenSeleccionada?.numero} — ${ordenSeleccionada?.proveedorRazonSocial}`} />
            </div>
            <div className="space-y-2">
              <Label>RUC del proveedor</Label>
              <Input disabled value={ordenSeleccionada?.proveedorRuc || "—"} />
            </div>
            <div className="space-y-2">
              <Label>Moneda (de la OC)</Label>
              <Input disabled value={moneda === "PEN" ? "Soles" : "Dólares"} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de ingreso</Label>
              <Input id="fecha" type="date" readOnly className="cursor-not-allowed bg-muted opacity-70" value={fecha} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaContabilizacion">Fecha de contabilización</Label>
              <Input
                id="fechaContabilizacion"
                type="date"
                max={fechaLocalHoy()}
                value={fechaContabilizacion}
                onChange={(e) => setFechaContabilizacion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guiaRemision">N° de guía de remisión</Label>
              <Input id="guiaRemision" value={guiaRemision} onChange={(e) => setGuiaRemision(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Usuario que hizo el ingreso</Label>
              <Input
                disabled
                className="cursor-not-allowed bg-muted opacity-70"
                value={`${usuario.nombres} ${usuario.apellidos}`}
              />
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="archivoGuia">Guía de remisión (foto, escaneo o PDF)</Label>
              <Input
                id="archivoGuia"
                type="file"
                accept="application/pdf,image/*"
                capture="environment"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              {archivo && <p className="text-xs text-muted-foreground">Seleccionado: {archivo.name}</p>}
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
              La cantidad a ingresar no puede superar lo pendiente de cada línea de la OC.
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
                        <TableHead className="w-28">Lote</TableHead>
                        <TableHead className="w-36">F. producción</TableHead>
                        <TableHead className="w-36">F. vencimiento</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium align-top">
                        {f.codigo}
                        {(requierePorAlmacen || f.skuRequiereLote) && <span className="text-destructive"> *</span>}
                      </TableCell>
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
          <Button type="button" variant="outline" onClick={() => setPaso(1)}>
            Atrás
          </Button>
          <Button type="button" disabled={enviando} onClick={handleRegistrar}>
            {enviando ? "Registrando..." : "Registrar Ingreso"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader titulo={titulo} descripcion={descripcion} acciones={accionesPaso1} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Elige la orden de compra y los productos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Los ingresos solo se registran en un almacén general; para repartirlo a un sub-almacén, usa un traslado
            después.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Almacén</Label>
              {almacenBloqueado ? (
                <Input disabled className="cursor-not-allowed bg-muted opacity-70" value={almacen?.nombre ?? ""} />
              ) : (
                <Select
                  value={almacenId}
                  onValueChange={(v) => {
                    setAlmacenId(v);
                    setAlmacenBloqueado(true);
                  }}
                >
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
              )}
            </div>
            <div className="space-y-2">
              <Label>Orden de compra (aprobadas, con ítems pendientes)</Label>
              <OrdenCompraPendienteCombobox
                ordenes={ordenesCompra.map((o) => ({ id: o.id, numero: o.numero, proveedorRazonSocial: o.proveedorRazonSocial }))}
                value={ordenCompraId}
                onSelect={seleccionarOrden}
              />
            </div>
          </div>

          {ordenSeleccionada ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead className="min-w-[180px]">Producto</TableHead>
                    <TableHead className="w-16">U.M.</TableHead>
                    <TableHead className="text-right w-24">Precio</TableHead>
                    <TableHead className="text-right w-24">Cant. OC</TableHead>
                    <TableHead className="text-right w-24">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenSeleccionada.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => alternarItem(item.id)}
                    >
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
                      <TableCell className="text-right">{formatMoneda(item.precioUnitario, moneda)}</TableCell>
                      <TableCell className="text-right">{formatCantidad(item.cantidadOc)}</TableCell>
                      <TableCell className="text-right">{formatCantidad(item.cantidadPendiente)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona una orden de compra para ver sus productos pendientes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
