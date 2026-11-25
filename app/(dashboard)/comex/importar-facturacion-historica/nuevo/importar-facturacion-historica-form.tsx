"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad } from "@/lib/utils";
import {
  analizarFacturacionHistoricaAction,
  confirmarFacturacionHistoricaAction,
  type AnalisisFacturacionHistorica,
} from "@/lib/actions/importar-facturacion-historica-actions";

export function ImportarFacturacionHistoricaForm() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisFacturacionHistorica | null>(null);
  const [confirmarReMigracion, setConfirmarReMigracion] = useState(false);
  const [analizando, startAnalisis] = useTransition();
  const [confirmando, startConfirmacion] = useTransition();

  function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
    setAnalisis(null);
    setConfirmarReMigracion(false);
  }

  function alAnalizar() {
    if (!archivo) {
      toast.error("Selecciona el archivo Excel.");
      return;
    }
    const fd = new FormData();
    fd.set("archivo", archivo);
    startAnalisis(async () => {
      const resultado = await analizarFacturacionHistoricaAction(fd);
      if (!resultado.ok) {
        toast.error(resultado.error);
        setAnalisis(null);
        return;
      }
      setAnalisis(resultado);
    });
  }

  function alConfirmar() {
    if (!archivo) return;
    const fd = new FormData();
    fd.set("archivo", archivo);
    startConfirmacion(async () => {
      const resultado = await confirmarFacturacionHistoricaAction(fd, confirmarReMigracion);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(
        `Migración completada: ${formatCantidad(resultado.registrosImportados ?? 0)} registros, ${formatCantidad(
          resultado.registrosVinculadosAEmbarque ?? 0
        )} vinculados a un embarque.`
      );
      router.push("/comex/importar-facturacion-historica");
    });
  }

  const bloqueadoPorDuplicado = analisis?.yaImportadoEsteArchivo === true;
  const necesitaConfirmacionAdmin = analisis?.existeMigracionPrevia === true && !bloqueadoPorDuplicado;
  const puedeConfirmar = !!analisis && !bloqueadoPorDuplicado && (!necesitaConfirmacionAdmin || confirmarReMigracion);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="archivo">Excel (.xlsx)</Label>
            <Input id="archivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={alElegirArchivo} />
          </div>
          <Button type="button" onClick={alAnalizar} disabled={!archivo || analizando}>
            {analizando ? "Analizando..." : "Analizar archivo"}
          </Button>
        </CardContent>
      </Card>

      {analisis && (
        <Card className={bloqueadoPorDuplicado ? "border-destructive" : necesitaConfirmacionAdmin ? "border-amber-400" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">Vista previa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Dato etiqueta="Hoja" valor={analisis.nombreHoja} />
              <Dato etiqueta="Filas leídas" valor={formatCantidad(analisis.totalFilasLeidas)} />
              <Dato etiqueta="Filas válidas a importar" valor={formatCantidad(analisis.totalFilas)} />
              <Dato etiqueta="PO distintos" valor={formatCantidad(analisis.poDistintos)} />
              <Dato etiqueta="Filas con algún error de fórmula" valor={formatCantidad(analisis.filasConError)} />
            </div>

            {bloqueadoPorDuplicado && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Este mismo archivo (idéntico contenido) ya se importó antes. No se puede volver a importar.</p>
              </div>
            )}

            {necesitaConfirmacionAdmin && (
              <div className="space-y-3 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Ya existe una migración histórica de Facturación completada. Repetirla con otro archivo requiere confirmación administrativa explícita — los registros ya migrados NO se borran.</p>
                </div>
                <label className="flex items-center gap-2">
                  <Checkbox checked={confirmarReMigracion} onCheckedChange={(v) => setConfirmarReMigracion(v === true)} />
                  <span>Confirmo que esta es una re-migración administrativa explícita.</span>
                </label>
              </div>
            )}

            {!bloqueadoPorDuplicado && !necesitaConfirmacionAdmin && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Primera migración de este tipo — lista para confirmar.</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" onClick={alConfirmar} disabled={!puedeConfirmar || confirmando}>
                {confirmando ? "Importando..." : "Confirmar importación"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
