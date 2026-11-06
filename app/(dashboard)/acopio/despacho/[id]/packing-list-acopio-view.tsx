"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { EstadoDespacho } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatKg, formatCantidad } from "@/lib/utils";
import { subirGuiaRemisionDespachoAction, culminarDespachoAction } from "@/lib/actions/despacho-actions";

type DespachoResumen = {
  id: string;
  numero: string;
  placaCamion: string;
  conductor: string;
  estado: EstadoDespacho;
  numeroGuiaRemision: string | null;
  guiaRemisionArchivo: string | null;
};
type TarjaFila = { id: string; numero: string; palletNumero: string; cantidadBandejas: number; pesoNetoKg: number };

export function PackingListAcopioView({
  despacho,
  tarjas,
  totalBandejas,
  pesoNetoTotalKg,
}: {
  despacho: DespachoResumen;
  tarjas: TarjaFila[];
  totalBandejas: number;
  pesoNetoTotalKg: number;
}) {
  const router = useRouter();
  const culminado = despacho.estado === "CULMINADO";
  const [numeroGuiaRemision, setNumeroGuiaRemision] = useState(despacho.numeroGuiaRemision ?? "");
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [culminando, setCulminando] = useState(false);

  async function handleCulminar() {
    if (!numeroGuiaRemision.trim()) {
      toast.error("El número de guía de remisión es obligatorio para culminar el proceso");
      return;
    }
    if (!archivoFile && !despacho.guiaRemisionArchivo) {
      toast.error("Adjunta la guía de remisión (foto o PDF) para culminar el proceso");
      return;
    }

    let guiaRemisionArchivo = despacho.guiaRemisionArchivo ?? "";
    if (archivoFile) {
      setSubiendo(true);
      try {
        const fd = new FormData();
        fd.set("archivo", archivoFile);
        const resultado = await subirGuiaRemisionDespachoAction(fd);
        if (resultado.error || !resultado.path) {
          toast.error(resultado.error ?? "No se pudo subir la guía de remisión");
          return;
        }
        guiaRemisionArchivo = resultado.path;
      } finally {
        setSubiendo(false);
      }
    }

    setCulminando(true);
    try {
      const resultado = await culminarDespachoAction(despacho.id, {
        numeroGuiaRemision: numeroGuiaRemision.trim(),
        guiaRemisionArchivo,
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Proceso culminado");
      router.refresh();
    } finally {
      setCulminando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Datos del despacho</CardTitle>
          <Badge variant={culminado ? "success" : "secondary"}>{culminado ? "Culminado" : "Borrador"}</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Código</p>
            <p className="font-medium">{despacho.numero}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Placa del camión</p>
            <p className="font-medium">{despacho.placaCamion}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conductor</p>
            <p className="font-medium">{despacho.conductor}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N.º de tarjas</p>
            <p className="font-medium">{tarjas.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarjas incluidas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarja</TableHead>
                <TableHead>Pallet</TableHead>
                <TableHead>Bandejas</TableHead>
                <TableHead>Peso neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tarjas.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.numero}</TableCell>
                  <TableCell>{t.palletNumero}</TableCell>
                  <TableCell>{formatCantidad(t.cantidadBandejas)}</TableCell>
                  <TableCell>{formatKg(t.pesoNetoKg)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-wrap justify-end gap-6 border-t pt-4 text-sm">
            <p>
              Total bandejas: <span className="font-medium">{formatCantidad(totalBandejas)}</span>
            </p>
            <p className="text-base">
              Peso neto total: <span className="font-semibold text-primary">{formatKg(pesoNetoTotalKg)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guía de remisión</CardTitle>
          <p className="text-sm text-muted-foreground">
            {culminado
              ? "Proceso culminado: la guía de remisión ya no se puede modificar."
              : "Obligatoria para Culminar proceso. Mientras falte, el Packing List sigue en Borrador."}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="numeroGuiaRemision">N.º de guía de remisión</Label>
            <Input
              id="numeroGuiaRemision"
              value={numeroGuiaRemision}
              onChange={(e) => setNumeroGuiaRemision(e.target.value)}
              disabled={culminado}
              className={culminado ? "cursor-not-allowed bg-muted opacity-70" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="archivoGuia">Guía de remisión (foto o PDF)</Label>
            <div className="flex items-center gap-3">
              {despacho.guiaRemisionArchivo && (
                <a
                  href={`/api/despachos/${despacho.id}/guia`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Ver archivo
                </a>
              )}
              {!culminado && (
                <Input
                  id="archivoGuia"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setArchivoFile(e.target.files?.[0] ?? null)}
                />
              )}
            </div>
            {archivoFile && <p className="text-xs text-muted-foreground">Seleccionado: {archivoFile.name}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" asChild>
          <a href={`/api/pdf/packing-list-acopio/${despacho.id}`} target="_blank" rel="noopener noreferrer">
            <FileDown className="mr-2 h-4 w-4" />
            Generar Packing List para este proceso
          </a>
        </Button>
        {!culminado && (
          <Button onClick={handleCulminar} disabled={subiendo || culminando}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {subiendo ? "Subiendo archivo..." : culminando ? "Culminando..." : "Culminar proceso"}
          </Button>
        )}
      </div>
    </div>
  );
}
