"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fechaInputValue } from "@/lib/utils";
import {
  analizarRechazoAction,
  confirmarRegistroRechazoAction,
  type AnalisisRechazoResultado,
  type LineaRechazoAnalizada,
  type EncabezadoRechazoEditable,
} from "@/lib/actions/registro-rechazos-actions";
import type { CategoriaRechazo } from "@prisma/client";

const CATEGORIA_LABEL: Record<CategoriaRechazo, string> = {
  TERMINAL_MARKET: "Terminal Market",
  NON_FRESH: "Non-Fresh",
  DONATION: "Donation",
  PASS: "Pass (fruta buena)",
};

const SIN_DISPOSICION = "__sin_definir__";

export function RegistroRechazoForm() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesandoOcr, setProcesandoOcr] = useState(false);
  const [progresoOcr, setProgresoOcr] = useState(0);
  const [textoOcr, setTextoOcr] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisRechazoResultado | null>(null);
  const [encabezado, setEncabezado] = useState<EncabezadoRechazoEditable | null>(null);
  const [lineas, setLineas] = useState<LineaRechazoAnalizada[]>([]);
  const [analizando, startAnalisis] = useTransition();
  const [confirmando, startConfirmacion] = useTransition();

  function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    setTextoOcr(null);
    setAnalisis(null);
    setEncabezado(null);
    setLineas([]);
  }

  async function alAnalizar() {
    if (!archivo) {
      toast.error("Selecciona una imagen.");
      return;
    }
    setProcesandoOcr(true);
    setProgresoOcr(0);
    try {
      // OCR en el navegador (pedido explícito, para no toparse con el
      // límite de tiempo de las functions de Vercel) — import dinámico,
      // mismo criterio que html-to-image/jspdf en Reporte de Acopio.
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgresoOcr(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(archivo);
      await worker.terminate();
      setTextoOcr(data.text);

      const fd = new FormData();
      fd.set("textoOcr", data.text);
      fd.set("archivo", archivo);
      startAnalisis(async () => {
        const resultado = await analizarRechazoAction(fd);
        setAnalisis(resultado);
        if (resultado.ok) {
          setEncabezado({
            asuntoCorreo: resultado.asuntoCorreo,
            remitente: resultado.remitente,
            fechaCorreo: resultado.fechaCorreo,
            poNumber: null,
            totalPalletsCorreo: resultado.totalPalletsCorreo,
            totalCajasRechazadasCorreo: resultado.totalCajasRechazadasCorreo,
          });
          setLineas(resultado.lineas);
        } else {
          toast.error(resultado.error);
        }
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la imagen (OCR).");
    } finally {
      setProcesandoOcr(false);
    }
  }

  function actualizarLinea(index: number, cambios: Partial<LineaRechazoAnalizada>) {
    setLineas((actual) => actual.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function alConfirmar() {
    if (!archivo || !textoOcr || !encabezado) return;
    const fd = new FormData();
    fd.set("textoOcr", textoOcr);
    fd.set("archivo", archivo);
    startConfirmacion(async () => {
      const resultado = await confirmarRegistroRechazoAction(fd, encabezado, lineas);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Rechazo registrado");
      router.push(`/comex/registro-rechazos/${resultado.id}`);
    });
  }

  const resultado = analisis?.ok ? analisis : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Captura del correo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="archivo">Imagen (PNG / JPG / WEBP)</Label>
            <Input id="archivo" type="file" accept="image/png,image/jpeg,image/webp" onChange={alElegirArchivo} />
          </div>
          <Button type="button" onClick={alAnalizar} disabled={!archivo || procesandoOcr || analizando}>
            {procesandoOcr ? `Leyendo imagen (OCR)... ${progresoOcr}%` : analizando ? "Cruzando con Packing List..." : "Analizar imagen"}
          </Button>
        </CardContent>
      </Card>

      {resultado && encabezado && (
        <>
          {resultado.advertencias.length > 0 && (
            <Card className="border-amber-400">
              <CardHeader>
                <CardTitle className="text-base text-amber-700">Advertencias</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                  {resultado.advertencias.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos generales (editables)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Ship Number (detectado)</Label>
                <Input value={resultado.shipNumber ?? ""} disabled />
                <p className="text-xs text-muted-foreground">
                  {resultado.embarqueNumero ? `Cruzado con ${resultado.embarqueNumero}` : "No se encontró un embarque importado."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>PO / N.º de orden</Label>
                <Input
                  value={encabezado.poNumber ?? ""}
                  onChange={(e) => setEncabezado({ ...encabezado, poNumber: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Asunto del correo</Label>
                <Input
                  value={encabezado.asuntoCorreo ?? ""}
                  onChange={(e) => setEncabezado({ ...encabezado, asuntoCorreo: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Remitente</Label>
                <Input
                  value={encabezado.remitente ?? ""}
                  onChange={(e) => setEncabezado({ ...encabezado, remitente: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha del correo</Label>
                <Input
                  type="date"
                  value={encabezado.fechaCorreo ? fechaInputValue(encabezado.fechaCorreo) : ""}
                  onChange={(e) => setEncabezado({ ...encabezado, fechaCorreo: e.target.value ? new Date(e.target.value) : null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total cajas (Rejection Summary)</Label>
                <Input
                  type="number"
                  value={encabezado.totalCajasRechazadasCorreo ?? ""}
                  onChange={(e) =>
                    setEncabezado({ ...encabezado, totalCajasRechazadasCorreo: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Líneas ({lineas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>LPN</TableHead>
                      <TableHead>Variedad (correo)</TableHead>
                      <TableHead>Item / SKU</TableHead>
                      <TableHead>Pallet (PL)</TableHead>
                      <TableHead numeric>Cajas PL</TableHead>
                      <TableHead numeric>Cajas rechazadas</TableHead>
                      <TableHead>Disposición final</TableHead>
                      <TableHead>Alertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineas.map((l, i) => (
                      <TableRow key={`${l.lpn}-${i}`}>
                        <TableCell className="font-mono font-medium">{l.lpn}</TableCell>
                        <TableCell>
                          <Input
                            className="w-[120px]"
                            value={l.variedad ?? ""}
                            onChange={(e) => actualizarLinea(i, { variedad: e.target.value || null })}
                          />
                          {l.variedadPL && <p className="mt-1 text-xs text-muted-foreground">PL: {l.variedadPL}</p>}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="mb-1 w-[140px]"
                            placeholder="Item code"
                            value={l.itemCode ?? ""}
                            onChange={(e) => actualizarLinea(i, { itemCode: e.target.value || null })}
                          />
                          <Input
                            className="w-[140px]"
                            placeholder="Descripción SKU"
                            value={l.descripcionSku ?? ""}
                            onChange={(e) => actualizarLinea(i, { descripcionSku: e.target.value || null })}
                          />
                        </TableCell>
                        <TableCell>{l.palletNumber ?? "—"}</TableCell>
                        <TableCell numeric>{l.cajasOriginales ?? "—"}</TableCell>
                        <TableCell numeric>
                          <Input
                            type="number"
                            className="w-[90px] text-right"
                            value={l.cajasRechazadas}
                            onChange={(e) => actualizarLinea(i, { cajasRechazadas: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={l.categoriaFinal ?? SIN_DISPOSICION}
                            onValueChange={(v) => actualizarLinea(i, { categoriaFinal: v === SIN_DISPOSICION ? null : (v as CategoriaRechazo) })}
                          >
                            <SelectTrigger className="w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SIN_DISPOSICION}>Sin definir</SelectItem>
                              {Object.entries(CATEGORIA_LABEL).map(([valor, etiqueta]) => (
                                <SelectItem key={valor} value={valor}>
                                  {etiqueta}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="space-y-1">
                          {l.alertaLpnNoEncontrado && <Badge variant="destructive">LPN no encontrado</Badge>}
                          {l.alertaVariedadNoCoincide && <Badge variant="warning">Variedad no coincide</Badge>}
                          {l.alertaExcedeOriginales && <Badge variant="destructive">Supera cajas originales</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="button" onClick={alConfirmar} disabled={confirmando}>
              {confirmando ? "Confirmando..." : "Confirmar registro"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
