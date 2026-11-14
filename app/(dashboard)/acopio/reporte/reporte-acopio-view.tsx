"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type MatrizModuloVariedad = {
  modulos: string[];
  variedades: string[];
  filas: { modulo: string; valores: number[]; total: number }[];
  totalesPorVariedad: number[];
  totalGeneral: number;
};

type ControlHorario = {
  filas: { ingresoFrutaId: string; placa: string; hora: string; kg: number }[];
  totalKg: number;
};

type MateriaPrima = {
  kgAprovechable: number;
  jabasAprovechable: number;
  kgNacionalCampo: number;
  jabasNacionalCampo: number;
  kgRecepcionado: number;
  jabasRecepcionado: number;
  pctAprovechable: number;
  pctNacionalCampo: number;
  matriz: MatrizModuloVariedad;
  controlHorario: ControlHorario;
};

type Industrial = {
  filas: { variedad: string; kg: number; jabas: number }[];
  totalKg: number;
  totalJabas: number;
};

function formatNumero(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPorcentaje(n: number) {
  return `${n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function ReporteAcopioView({
  generadoEn,
  semanaTexto,
  rangoFechas,
  cantidadIngresos,
  materiaPrima,
  industrial,
}: {
  generadoEn: string;
  semanaTexto: string;
  rangoFechas: { desde: string | null; hasta: string | null };
  cantidadIngresos: number;
  materiaPrima: MateriaPrima;
  industrial: Industrial;
}) {
  const refMateriaPrima = useRef<HTMLDivElement>(null);
  const refIndustrial = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState<"png" | "pdf" | null>(null);

  const rangoTexto = rangoFechas.desde || rangoFechas.hasta ? `Cosecha ${rangoFechas.desde ?? "…"} – ${rangoFechas.hasta ?? "…"} · ` : "";
  const subtitulo = `${generadoEn} · ${rangoTexto}${semanaTexto}`;

  async function exportarPng(ref: React.RefObject<HTMLDivElement>, nombreArchivo: string) {
    if (!ref.current) return;
    setExportando("png");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${nombreArchivo}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("No se pudo exportar la imagen");
    } finally {
      setExportando(null);
    }
  }

  async function exportarPdf(ref: React.RefObject<HTMLDivElement>, nombreArchivo: string) {
    if (!ref.current) return;
    setExportando("pdf");
    try {
      const [{ toPng }, { default: jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const imagen = new window.Image();
      imagen.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        imagen.onload = () => resolve();
        imagen.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      });
      const pdf = new jsPDF({
        orientation: imagen.width > imagen.height ? "landscape" : "portrait",
        unit: "px",
        format: [imagen.width, imagen.height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, imagen.width, imagen.height);
      pdf.save(`${nombreArchivo}.pdf`);
    } catch {
      toast.error("No se pudo exportar el PDF");
    } finally {
      setExportando(null);
    }
  }

  return (
    <Tabs defaultValue="materia-prima">
      <div className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center print:hidden">
        <TabsList>
          <TabsTrigger value="materia-prima">Materia Prima</TabsTrigger>
          <TabsTrigger value="industrial">Industrial</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="materia-prima">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            disabled={exportando !== null}
            onClick={() => exportarPng(refMateriaPrima, "recepcion-materia-prima")}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportando === "png" ? "Exportando..." : "PNG"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exportando !== null}
            onClick={() => exportarPdf(refMateriaPrima, "recepcion-materia-prima")}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {exportando === "pdf" ? "Exportando..." : "PDF"}
          </Button>
        </div>

        <div ref={refMateriaPrima} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <Encabezado titulo="Resumen de recepción de materia prima" subtitulo={subtitulo} cantidadIngresos={cantidadIngresos} />

          <div className="my-5 border-t" />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <KpiBloque label="Total recepcionado" valor={formatNumero(materiaPrima.kgRecepcionado)} unidad="kg" secundario={`${materiaPrima.jabasRecepcionado.toLocaleString("es-PE")} jabas`} />
            <KpiBloque
              label="Aprovechable"
              valor={formatPorcentaje(materiaPrima.pctAprovechable)}
              colorClase="text-emerald-600"
              secundario={`${formatNumero(materiaPrima.kgAprovechable)} kg · ${materiaPrima.jabasAprovechable.toLocaleString("es-PE")} jabas`}
            />
            <KpiBloque
              label="Nacional Campo"
              valor={formatPorcentaje(materiaPrima.pctNacionalCampo)}
              colorClase="text-amber-600"
              secundario={`${formatNumero(materiaPrima.kgNacionalCampo)} kg · ${materiaPrima.jabasNacionalCampo.toLocaleString("es-PE")} jabas`}
            />
          </div>

          <div className="my-5 border-t" />

          <BarraSegmentada pctAprovechable={materiaPrima.pctAprovechable} pctNacionalCampo={materiaPrima.pctNacionalCampo} />

          <div className="my-5 border-t" />

          <SeccionTitulo>Kg recepcionado por módulo y variedad</SeccionTitulo>
          <MatrizModuloVariedadTabla matriz={materiaPrima.matriz} />

          <div className="my-5 border-t" />

          <SeccionTitulo>Control horario de recepción</SeccionTitulo>
          <ControlHorarioTabla controlHorario={materiaPrima.controlHorario} />
        </div>
      </TabsContent>

      <TabsContent value="industrial">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            disabled={exportando !== null}
            onClick={() => exportarPng(refIndustrial, "recepcion-industrial")}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportando === "png" ? "Exportando..." : "PNG"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exportando !== null}
            onClick={() => exportarPdf(refIndustrial, "recepcion-industrial")}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {exportando === "pdf" ? "Exportando..." : "PDF"}
          </Button>
        </div>

        <div ref={refIndustrial} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <Encabezado titulo="Resumen de recepción industrial" subtitulo={subtitulo} cantidadIngresos={null} />

          <div className="my-5 border-t" />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <KpiBloque label="Total recepcionado" valor={formatNumero(industrial.totalKg)} unidad="kg" />
            <KpiBloque label="Total jabas" valor={industrial.totalJabas.toLocaleString("es-PE")} />
          </div>

          <div className="my-5 border-t" />

          <SeccionTitulo>Kg recepcionado por variedad</SeccionTitulo>
          <IndustrialTabla industrial={industrial} />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Encabezado({ titulo, subtitulo, cantidadIngresos }: { titulo: string; subtitulo: string; cantidadIngresos: number | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-white p-1">
        <Image src="/logo-rpb.jpg" alt="Logo de REITER PERUVIAN BERRY" fill sizes="44px" className="object-contain p-0.5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight tracking-tight sm:text-lg">{titulo}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {subtitulo}
          {cantidadIngresos !== null && ` · ${cantidadIngresos} ingreso${cantidadIngresos === 1 ? "" : "s"}`}
        </p>
      </div>
    </div>
  );
}

function SeccionTitulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{children}</h2>;
}

function KpiBloque({
  label,
  valor,
  unidad,
  secundario,
  colorClase,
}: {
  label: string;
  valor: string;
  unidad?: string;
  secundario?: string;
  colorClase?: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-bold tabular-nums tracking-tight sm:text-4xl", colorClase)}>
        {valor}
        {unidad && <span className="ml-1 text-xl font-semibold text-muted-foreground">{unidad}</span>}
      </p>
      {secundario && <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{secundario}</p>}
    </div>
  );
}

function BarraSegmentada({ pctAprovechable, pctNacionalCampo }: { pctAprovechable: number; pctNacionalCampo: number }) {
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-full bg-muted">
        {pctAprovechable > 0 && (
          <div
            style={{ width: `${pctAprovechable}%` }}
            className="flex items-center justify-center bg-emerald-600 text-xs font-semibold text-white"
          >
            {pctAprovechable >= 10 ? formatPorcentaje(pctAprovechable) : ""}
          </div>
        )}
        {pctNacionalCampo > 0 && (
          <div
            style={{ width: `${pctNacionalCampo}%` }}
            className="flex items-center justify-center bg-amber-500 text-xs font-semibold text-white"
          >
            {pctNacionalCampo >= 10 ? formatPorcentaje(pctNacionalCampo) : ""}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" /> Aprovechable {formatPorcentaje(pctAprovechable)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Nacional Campo {formatPorcentaje(pctNacionalCampo)}
        </span>
      </div>
    </div>
  );
}

function MatrizModuloVariedadTabla({ matriz }: { matriz: MatrizModuloVariedad }) {
  if (matriz.modulos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos en el filtro elegido.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Módulo</TableHead>
            {matriz.variedades.map((v) => (
              <TableHead key={v} numeric>
                {v}
              </TableHead>
            ))}
            <TableHead numeric>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matriz.filas.map((fila) => (
            <TableRow key={fila.modulo}>
              <TableCell className="font-medium">{fila.modulo}</TableCell>
              {fila.valores.map((v, i) => (
                <TableCell key={i} numeric>
                  {formatNumero(v)}
                </TableCell>
              ))}
              <TableCell numeric className="font-semibold">
                {formatNumero(fila.total)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell>Total</TableCell>
            {matriz.totalesPorVariedad.map((v, i) => (
              <TableCell key={i} numeric>
                {formatNumero(v)}
              </TableCell>
            ))}
            <TableCell numeric>{formatNumero(matriz.totalGeneral)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function ControlHorarioTabla({ controlHorario }: { controlHorario: ControlHorario }) {
  if (controlHorario.filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos en el filtro elegido.</p>;
  }
  return (
    <div className="max-h-[420px] overflow-y-auto overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/40">
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead numeric>Kg</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controlHorario.filas.map((f) => (
            <TableRow key={f.ingresoFrutaId}>
              <TableCell>{f.hora}</TableCell>
              <TableCell className="font-mono font-medium">{f.placa}</TableCell>
              <TableCell numeric>{formatNumero(f.kg)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell numeric>{formatNumero(controlHorario.totalKg)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function IndustrialTabla({ industrial }: { industrial: Industrial }) {
  if (industrial.filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos de Recepción Industrial en el filtro elegido.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Variedad</TableHead>
            <TableHead numeric>Kg</TableHead>
            <TableHead numeric>Jabas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {industrial.filas.map((f) => (
            <TableRow key={f.variedad}>
              <TableCell className="font-medium">{f.variedad}</TableCell>
              <TableCell numeric>{formatNumero(f.kg)}</TableCell>
              <TableCell numeric>{f.jabas.toLocaleString("es-PE")}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell numeric>{formatNumero(industrial.totalKg)}</TableCell>
            <TableCell numeric>{industrial.totalJabas.toLocaleString("es-PE")}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
