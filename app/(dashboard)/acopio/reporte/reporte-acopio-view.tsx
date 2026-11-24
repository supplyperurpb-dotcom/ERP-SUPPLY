"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatModuloCompacto } from "@/lib/constants/modulos";
import { cn } from "@/lib/utils";
import type { FilaResumenRecepcion, DatosReporteRecepcion } from "@/lib/acopio-reporte";

// Verde = Aprovechable, turquesa = Nacional — pedido explícito del usuario
// (texto + foto de referencia del dashboard "Reporte de Recepción"). Verde
// ya estaba establecido en este mismo reporte; turquesa es el primer uso de
// ese tono en el proyecto.
const COLOR_APROVECHABLE = "#397653";
const COLOR_NACIONAL = "#0D9488";

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
  campaniaTexto,
  rangoFechas,
  cantidadIngresos,
  pdfHref,
  materiaPrima,
  industrial,
}: {
  generadoEn: string;
  semanaTexto: string;
  campaniaTexto: string | null;
  rangoFechas: { desde: string | null; hasta: string | null };
  cantidadIngresos: number;
  pdfHref: string;
  materiaPrima: DatosReporteRecepcion;
  industrial: Industrial;
}) {
  const refIndustrial = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState<"png" | "pdf" | null>(null);

  const rangoTexto = rangoFechas.desde || rangoFechas.hasta ? `Cosecha ${rangoFechas.desde ?? "…"} – ${rangoFechas.hasta ?? "…"} · ` : "";
  const subtitulo = `${generadoEn} · ${rangoTexto}${campaniaTexto ? `${campaniaTexto} · ` : ""}${semanaTexto}`;

  // Pedido explícito (pestaña Industrial, sin cambios): los botones abren
  // una VISTA (nueva pestaña), no fuerzan la descarga automática. NO se abre
  // una pestaña en blanco primero para redirigirla después — los
  // navegadores modernos bloquean en silencio esa navegación tardía de una
  // pestaña ya abierta hacia una URL blob: (no tira error, queda en blanco
  // para siempre). Por eso `window.open` recibe directamente la URL ya
  // lista, en un solo paso.
  function abrirBlobEnNuevaPestana(url: string) {
    if (!window.open(url, "_blank")) {
      toast.error("El navegador bloqueó la vista. Permite ventanas emergentes para este sitio e inténtalo de nuevo.");
    }
  }

  async function verPng(ref: React.RefObject<HTMLDivElement>) {
    if (!ref.current) return;
    setExportando("png");
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      if (!blob) throw new Error("No se pudo generar la imagen");
      abrirBlobEnNuevaPestana(URL.createObjectURL(blob));
    } catch {
      toast.error("No se pudo generar la imagen");
    } finally {
      setExportando(null);
    }
  }

  async function verPdf(ref: React.RefObject<HTMLDivElement>) {
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
      // pdf.output("bloburl") está mal tipado en jspdf@4.2.1: el .d.ts dice
      // que devuelve `URL`, pero en runtime devuelve directamente el string
      // de URL.createObjectURL (ver node_modules/jspdf/dist/jspdf.es.min.js).
      // Se construye la blob URL a mano, igual que en verPng.
      abrirBlobEnNuevaPestana(URL.createObjectURL(pdf.output("blob")));
    } catch {
      toast.error("No se pudo generar el PDF");
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
        {/* Tarja PDF real (pdf-lib, texto nativo) — reemplaza los antiguos
            "Ver PNG"/"Ver PDF" (captura de pantalla) solo acá. Navegación
            simple a una URL real: no hace falta JS ni estado de carga, el
            visor de PDF del navegador ya trae sus propios botones de
            descargar/imprimir/compartir. */}
        <div className="mb-3 flex justify-end print:hidden">
          <Button variant="outline" size="sm" asChild>
            <a href={pdfHref} target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" />
              Generar Tarja PDF
            </a>
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <Encabezado titulo="Reporte de Recepción" subtitulo={subtitulo} cantidadIngresos={cantidadIngresos} />

          <div className="my-5 border-t" />

          <SeccionTitulo numero={1}>Indicadores generales</SeccionTitulo>
          <IndicadoresGenerales materiaPrima={materiaPrima} cantidadIngresos={cantidadIngresos} />

          <div className="my-5 border-t" />

          <SeccionTitulo numero={2}>Resumen por módulo y variedad</SeccionTitulo>
          <ResumenVariedadModuloTabla resumen={materiaPrima.resumen} materiaPrima={materiaPrima} />
        </div>
      </TabsContent>

      <TabsContent value="industrial">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <Button variant="outline" size="sm" disabled={exportando !== null} onClick={() => verPng(refIndustrial)}>
            <Eye className="mr-2 h-4 w-4" />
            {exportando === "png" ? "Abriendo..." : "Ver PNG"}
          </Button>
          <Button variant="outline" size="sm" disabled={exportando !== null} onClick={() => verPdf(refIndustrial)}>
            <Eye className="mr-2 h-4 w-4" />
            {exportando === "pdf" ? "Abriendo..." : "Ver PDF"}
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

function SeccionTitulo({ numero, children }: { numero?: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold text-foreground">
      {numero && `${numero}. `}
      {children}
    </h2>
  );
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

// "TOTAL RECIBIDO" + barra proporcional (Aprovechable/Nacional) + desglose
// en 2 columnas — reemplaza las 2 KPICard de antes. Pedido explícito, calca
// la estructura de la foto de referencia del usuario, con los colores ya
// establecidos del ERP (fondo claro, no el fondo oscuro de la foto).
function IndicadoresGenerales({ materiaPrima, cantidadIngresos }: { materiaPrima: DatosReporteRecepcion; cantidadIngresos: number }) {
  const { kgRecepcionado, kgAprovechable, kgNacionalCampo, pctAprovechable, pctNacionalCampo } = materiaPrima;
  const hayDatos = kgRecepcionado > 0;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total recibido</p>
      <p className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">{formatNumero(kgRecepcionado)} Kg</p>
      <p className="text-sm text-muted-foreground">
        {cantidadIngresos} ingreso{cantidadIngresos === 1 ? "" : "s"}
      </p>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distribución de recepción</p>
      {hayDatos ? (
        <div className="flex h-9 w-full overflow-hidden rounded-md text-sm font-semibold text-white">
          {pctAprovechable > 0 && (
            <div className="flex items-center justify-center" style={{ width: `${pctAprovechable}%`, backgroundColor: COLOR_APROVECHABLE }}>
              {pctAprovechable >= 12 && formatPorcentaje(pctAprovechable)}
            </div>
          )}
          {pctNacionalCampo > 0 && (
            <div className="flex items-center justify-center" style={{ width: `${pctNacionalCampo}%`, backgroundColor: COLOR_NACIONAL }}>
              {pctNacionalCampo >= 12 && formatPorcentaje(pctNacionalCampo)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-9 w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">Sin datos</div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLOR_APROVECHABLE }} />
            <span className="text-sm font-medium text-muted-foreground">Aprovechable</span>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl" style={{ color: COLOR_APROVECHABLE }}>
            {formatNumero(kgAprovechable)} kg
          </p>
          <p className="text-sm text-muted-foreground">{formatPorcentaje(pctAprovechable)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLOR_NACIONAL }} />
            <span className="text-sm font-medium text-muted-foreground">Nacional</span>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl" style={{ color: COLOR_NACIONAL }}>
            {formatNumero(kgNacionalCampo)} kg
          </p>
          <p className="text-sm text-muted-foreground">{formatPorcentaje(pctNacionalCampo)}</p>
        </div>
      </div>
    </div>
  );
}

// Padding/tamaño de letra responsive, reusado en todas las celdas de esta
// tabla — compacto en celular (para que las 5 columnas entren sin scroll
// horizontal, pedido explícito) y el tamaño normal de siempre desde `sm:`.
// align-top (pedido explícito): el Total es una sola línea mientras que
// Aprovechable/Nacional tienen 2 (kg + %) — con el align-middle de
// TableCell por defecto, el Total quedaba centrado en el alto de la fila
// en vez de a la misma altura que la línea de kg de las otras columnas.
const CELDA_RESUMEN = "whitespace-nowrap px-1.5 py-2 text-[11px] align-top sm:px-4 sm:py-3 sm:text-sm";

// Celda de 2 líneas (kg + % de ESA fila, no el % global) — mismo patrón en
// la tabla y en la fila de total general.
function CeldaKgPorcentaje({ kg, pct, color }: { kg: number; pct: number; color: string }) {
  return (
    <TableCell numeric className={CELDA_RESUMEN}>
      <div className="font-semibold tabular-nums">
        {formatNumero(kg)}
        <span className="hidden sm:inline"> kg</span>
      </div>
      <div className="text-[9px] font-medium tabular-nums sm:text-xs" style={{ color }}>
        {formatPorcentaje(pct)}
      </div>
    </TableCell>
  );
}

function ResumenVariedadModuloTabla({
  resumen,
  materiaPrima,
}: {
  resumen: FilaResumenRecepcion[];
  materiaPrima: DatosReporteRecepcion;
}) {
  if (resumen.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos en el filtro elegido.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn("bg-muted/40", CELDA_RESUMEN)}>
              <span className="sm:hidden">MÓD.</span>
              <span className="hidden sm:inline">Módulo</span>
            </TableHead>
            <TableHead className={cn("bg-muted/40", CELDA_RESUMEN)}>
              <span className="sm:hidden">VAR.</span>
              <span className="hidden sm:inline">Variedad</span>
            </TableHead>
            <TableHead numeric className={cn("bg-muted/40", CELDA_RESUMEN)} style={{ color: COLOR_APROVECHABLE }}>
              <span className="sm:hidden">APROV.</span>
              <span className="hidden sm:inline">Aprov.</span>
            </TableHead>
            <TableHead numeric className={cn("bg-muted/40", CELDA_RESUMEN)} style={{ color: COLOR_NACIONAL }}>
              <span className="sm:hidden">NAC.</span>
              <span className="hidden sm:inline">Nacional</span>
            </TableHead>
            <TableHead numeric className={cn("bg-muted/40", CELDA_RESUMEN)}>
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resumen.map((fila) => (
            <TableRow key={`${fila.modulo}__${fila.variedad}`}>
              <TableCell className={CELDA_RESUMEN}>
                <span className="inline-flex items-center rounded-md bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground sm:px-2 sm:text-xs">
                  {formatModuloCompacto(fila.modulo)}
                </span>
              </TableCell>
              <TableCell className={cn(CELDA_RESUMEN, "font-medium")}>{fila.variedad}</TableCell>
              <CeldaKgPorcentaje
                kg={fila.aprovechableKg}
                pct={fila.total > 0 ? (fila.aprovechableKg / fila.total) * 100 : 0}
                color={COLOR_APROVECHABLE}
              />
              <CeldaKgPorcentaje
                kg={fila.nacionalKg}
                pct={fila.total > 0 ? (fila.nacionalKg / fila.total) * 100 : 0}
                color={COLOR_NACIONAL}
              />
              <TableCell numeric className={cn(CELDA_RESUMEN, "font-semibold")}>
                {formatNumero(fila.total)}
                <span className="hidden sm:inline"> kg</span>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-emerald-50 font-semibold">
            <TableCell colSpan={2} className={CELDA_RESUMEN}>
              <span className="sm:hidden">TOTAL</span>
              <span className="hidden sm:inline">TOTAL GENERAL</span>
            </TableCell>
            <CeldaKgPorcentaje kg={materiaPrima.kgAprovechable} pct={materiaPrima.pctAprovechable} color={COLOR_APROVECHABLE} />
            <CeldaKgPorcentaje kg={materiaPrima.kgNacionalCampo} pct={materiaPrima.pctNacionalCampo} color={COLOR_NACIONAL} />
            <TableCell numeric className={CELDA_RESUMEN}>
              {formatNumero(materiaPrima.kgRecepcionado)}
              <span className="hidden sm:inline"> kg</span>
            </TableCell>
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
