"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Trash2 } from "lucide-react";
import { fechaLocalHoy } from "@/lib/utils";
import { crearSolicitudTrasladoAction } from "@/lib/actions/solicitud-traslado-actions";
import type { SolicitudTrasladoInput } from "@/lib/validations/solicitud-traslado";
import type { FilaStockAlmacen } from "@/lib/stock-almacen";

type ItemSolicitud = {
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
};

export function SolicitudTrasladoBuilder({
  almacenes,
  stockPorAlmacen,
}: {
  almacenes: { id: string; nombre: string }[];
  stockPorAlmacen: Record<string, FilaStockAlmacen[]>;
}) {
  const router = useRouter();
  const fecha = fechaLocalHoy();

  const [almacenOrigenId, setAlmacenOrigenId] = useState("");
  const [almacenDestinoId, setAlmacenDestinoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemSolicitud[]>([]);
  const [enviando, setEnviando] = useState(false);

  const [filaDialogo, setFilaDialogo] = useState<FilaStockAlmacen | null>(null);
  const [cantidadDialogo, setCantidadDialogo] = useState("");

  const [resultado, setResultado] = useState<{ id: string; numero: string } | null>(null);

  const [filtroProducto, setFiltroProducto] = useState("");

  const almacenOrigen = almacenes.find((a) => a.id === almacenOrigenId);
  const almacenDestino = almacenes.find((a) => a.id === almacenDestinoId);
  const stockOrigen = almacenOrigenId ? stockPorAlmacen[almacenOrigenId] ?? [] : [];
  const stockOrigenFiltrado = stockOrigen.filter((fila) => {
    const termino = filtroProducto.trim().toLowerCase();
    if (!termino) return true;
    return `${fila.codigo} ${fila.descripcion}`.toLowerCase().includes(termino);
  });

  function cantidadYaAgregada(skuId: string) {
    return items.find((i) => i.skuId === skuId)?.cantidad ?? 0;
  }

  function cambiarOrigen(id: string) {
    setAlmacenOrigenId(id);
    setItems([]); // el stock disponible cambia por completo con el almacén
    setFiltroProducto("");
  }

  function abrirDialogo(fila: FilaStockAlmacen) {
    setFilaDialogo(fila);
    setCantidadDialogo(String(fila.cantidad - cantidadYaAgregada(fila.skuId)));
  }

  function confirmarDialogo() {
    if (!filaDialogo) return;
    const cantidad = Number(cantidadDialogo) || 0;
    if (cantidad <= 0 || cantidad > filaDialogo.cantidad) {
      toast.error(`La cantidad a trasladar debe ser mayor a 0 y no superar lo disponible (${filaDialogo.cantidad})`);
      return;
    }
    setItems((prev) => {
      const existe = prev.find((i) => i.skuId === filaDialogo.skuId);
      if (existe) {
        return prev.map((i) => (i.skuId === filaDialogo.skuId ? { ...i, cantidad } : i));
      }
      return [
        ...prev,
        {
          skuId: filaDialogo.skuId,
          codigo: filaDialogo.codigo,
          descripcion: filaDialogo.descripcion,
          unidadMedida: filaDialogo.unidadMedida,
          cantidad,
        },
      ];
    });
    setFilaDialogo(null);
  }

  function quitarItem(skuId: string) {
    setItems((prev) => prev.filter((i) => i.skuId !== skuId));
  }

  async function handleSolicitar() {
    if (!almacenOrigenId) {
      toast.error("Selecciona el almacén de origen");
      return;
    }
    if (!almacenDestinoId) {
      toast.error("Selecciona el almacén de destino");
      return;
    }
    if (items.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    setEnviando(true);
    try {
      const payload: SolicitudTrasladoInput = {
        almacenOrigenId,
        almacenDestinoId,
        fecha: new Date(fecha) as unknown as Date,
        observaciones,
        items: items.map((i) => ({ skuId: i.skuId, cantidad: i.cantidad, unidadMedida: i.unidadMedida })),
      };
      const resultadoAccion = await crearSolicitudTrasladoAction(payload);
      if (resultadoAccion?.error || !resultadoAccion?.id || !resultadoAccion?.numero) {
        toast.error(resultadoAccion?.error ?? "No se pudo registrar la solicitud");
        return;
      }
      window.open(`/api/pdf/solicitud-traslado/${resultadoAccion.id}`, "_blank");
      setResultado({ id: resultadoAccion.id, numero: resultadoAccion.numero });
    } catch (err) {
      console.error("Error al registrar la solicitud de traslado:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitud de traslado {resultado.numero} registrada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Origen</p>
              <p className="font-medium">{almacenOrigen?.nombre}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Destino</p>
              <p className="font-medium">{almacenDestino?.nombre}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">{fecha}</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>U.M.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.skuId}>
                  <TableCell className="font-medium">{i.codigo}</TableCell>
                  <TableCell>{i.descripcion}</TableCell>
                  <TableCell className="text-right">{i.cantidad}</TableCell>
                  <TableCell>{i.unidadMedida}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href="/logistica/solicitudes-traslado">Volver al listado</Link>
            </Button>
            <Button asChild>
              <Link href={`/logistica/solicitudes-traslado/${resultado.id}`}>Ver detalle completo</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la solicitud</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Almacén origen</Label>
            <Select value={almacenOrigenId} onValueChange={cambiarOrigen}>
              <SelectTrigger>
                <SelectValue placeholder="¿De dónde sale?" />
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
          <div className="space-y-2">
            <Label>Almacén destino</Label>
            <Select value={almacenDestinoId} onValueChange={setAlmacenDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="¿A dónde llega?" />
              </SelectTrigger>
              <SelectContent>
                {almacenes
                  .filter((a) => a.id !== almacenOrigenId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input disabled value={fecha} />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {almacenOrigenId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock disponible en {almacenOrigen?.nombre}</CardTitle>
            <p className="text-sm text-muted-foreground">Haz clic en un producto para indicar cuánto quieres trasladar.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {stockOrigen.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este almacén no tiene stock disponible.</p>
            ) : (
              <>
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por código o nombre de producto..."
                    value={filtroProducto}
                    onChange={(e) => setFiltroProducto(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {stockOrigenFiltrado.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ningún producto coincide con &quot;{filtroProducto}&quot;.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Código</TableHead>
                          <TableHead className="min-w-[180px]">Producto</TableHead>
                          <TableHead className="w-16">U.M.</TableHead>
                          <TableHead className="text-right w-28">Disponible</TableHead>
                          <TableHead className="text-right w-28">Ya agregado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockOrigenFiltrado.map((fila) => (
                          <TableRow key={fila.skuId} className="cursor-pointer" onClick={() => abrirDialogo(fila)}>
                            <TableCell className="font-medium">{fila.codigo}</TableCell>
                            <TableCell>{fila.descripcion}</TableCell>
                            <TableCell>{fila.unidadMedida}</TableCell>
                            <TableCell className="text-right">{fila.cantidad}</TableCell>
                            <TableCell className="text-right">{cantidadYaAgregada(fila.skuId) || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos a solicitar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>U.M.</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.skuId}>
                    <TableCell className="font-medium">{i.codigo}</TableCell>
                    <TableCell>{i.descripcion}</TableCell>
                    <TableCell className="text-right">{i.cantidad}</TableCell>
                    <TableCell>{i.unidadMedida}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => quitarItem(i.skuId)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleSolicitar}>
          {enviando ? "Solicitando..." : "Solicitar traslado"}
        </Button>
      </div>

      <Dialog open={!!filaDialogo} onOpenChange={(open) => !open && setFilaDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cantidad a trasladar</DialogTitle>
          </DialogHeader>
          {filaDialogo && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {filaDialogo.codigo} — {filaDialogo.descripcion} (disponible: {filaDialogo.cantidad} {filaDialogo.unidadMedida})
              </p>
              <div className="space-y-2">
                <Label htmlFor="cantidadDialogo">Cantidad a trasladar</Label>
                <Input
                  id="cantidadDialogo"
                  type="number"
                  min={0}
                  max={filaDialogo.cantidad}
                  step="0.001"
                  value={cantidadDialogo}
                  onChange={(e) => setCantidadDialogo(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFilaDialogo(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmarDialogo}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
