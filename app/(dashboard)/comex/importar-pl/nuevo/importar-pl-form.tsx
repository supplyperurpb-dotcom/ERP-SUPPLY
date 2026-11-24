"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad, formatDate } from "@/lib/utils";
import {
  analizarPackingListAction,
  confirmarImportacionPackingListAction,
  type AnalisisPackingListResultado,
} from "@/lib/actions/importar-pl-actions";

export function ImportarPlForm() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisPackingListResultado | null>(null);
  const [analizando, startAnalisis] = useTransition();
  const [confirmando, startConfirmacion] = useTransition();

  function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    setAnalisis(null);
  }

  function alAnalizar() {
    if (!archivo) {
      toast.error("Selecciona un archivo Excel.");
      return;
    }
    const fd = new FormData();
    fd.set("archivo", archivo);
    startAnalisis(async () => {
      const resultado = await analizarPackingListAction(fd);
      setAnalisis(resultado);
      if (!resultado.ok) toast.error(resultado.error);
    });
  }

  function alConfirmar() {
    if (!archivo) return;
    const fd = new FormData();
    fd.set("archivo", archivo);
    startConfirmacion(async () => {
      const resultado = await confirmarImportacionPackingListAction(fd);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Packing List importado");
      router.push(`/comex/importar-pl/${resultado.id}`);
    });
  }

  const resultado = analisis?.ok ? analisis.resultado : null;
  const puedeConfirmar = !!resultado && resultado.errores.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="archivo">Excel del Packing List (.xlsx / .xls)</Label>
            <Input id="archivo" type="file" accept=".xlsx,.xls" onChange={alElegirArchivo} />
          </div>
          <Button type="button" onClick={alAnalizar} disabled={!archivo || analizando}>
            {analizando ? "Analizando..." : "Analizar archivo"}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <>
          {resultado.errores.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-base text-destructive">No se puede importar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                  {resultado.errores.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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
              <CardTitle className="text-base">Datos del embarque</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <Dato etiqueta="Ship Number" valor={resultado.embarque.shipNumber} />
              <Dato etiqueta="Grower" valor={resultado.embarque.grower} />
              <Dato etiqueta="Consignee" valor={resultado.embarque.consignee} />
              <Dato etiqueta="Notify" valor={resultado.embarque.notify} />
              <Dato etiqueta="Naviera" valor={resultado.embarque.naviera} />
              <Dato etiqueta="Nave" valor={resultado.embarque.vessel} />
              <Dato etiqueta="Contenedor" valor={resultado.embarque.contenedor} />
              <Dato etiqueta="BL/SWB" valor={resultado.embarque.blSwb} />
              <Dato etiqueta="Tipo" valor={resultado.embarque.tipoEmbarque} />
              <Dato etiqueta="Puerto de carga" valor={resultado.embarque.origenPuerto} />
              <Dato etiqueta="Puerto de descarga" valor={resultado.embarque.destinoPuerto} />
              <Dato etiqueta="Fecha de carga" valor={resultado.embarque.fechaCarga ? formatDate(resultado.embarque.fechaCarga) : null} />
              <Dato etiqueta="ETD" valor={resultado.embarque.etd ? formatDate(resultado.embarque.etd) : null} />
              <Dato etiqueta="ETA" valor={resultado.embarque.eta ? formatDate(resultado.embarque.eta) : null} />
              <Dato
                etiqueta="Total Cases (Excel)"
                valor={resultado.embarque.totalCasesExcel != null ? formatCantidad(resultado.embarque.totalCasesExcel) : null}
              />
              <Dato
                etiqueta="Total Net Weight (Excel)"
                valor={resultado.embarque.totalNetWeightExcel != null ? formatCantidad(resultado.embarque.totalNetWeightExcel) : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pallets ({resultado.pallets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[480px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/40">
                    <TableRow>
                      <TableHead>Pallet</TableHead>
                      <TableHead>Variedad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead numeric>Cases</TableHead>
                      <TableHead numeric>Net Weight</TableHead>
                      <TableHead>LPN</TableHead>
                      <TableHead>Trazabilidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.pallets.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{p.palletNumber}</TableCell>
                        <TableCell>{p.variedad}</TableCell>
                        <TableCell>{p.descripcionSku ?? "—"}</TableCell>
                        <TableCell>{p.label ?? "—"}</TableCell>
                        <TableCell numeric>{formatCantidad(p.cases)}</TableCell>
                        <TableCell numeric>{formatCantidad(p.pesoNetoKg)}</TableCell>
                        <TableCell className="font-mono">{p.lpnDriscolls ?? "—"}</TableCell>
                        <TableCell className="font-mono">{p.trazabilityCodeDoc ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="button" onClick={alConfirmar} disabled={!puedeConfirmar || confirmando}>
              {confirmando ? "Confirmando..." : "Confirmar importación"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="font-medium">{valor || "—"}</p>
    </div>
  );
}
