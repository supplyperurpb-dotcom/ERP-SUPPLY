"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Eye, Leaf, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard } from "@/components/ui/cards/kpi-card";
import { formatModuloCompacto } from "@/lib/constants/modulos";
import { cn } from "@/lib/utils";

// Mismos hex ya usados como paleta de tarjetas KPI en el dashboard de
// Exportaciones (ver PALETA_FACTURADO/PALETA_LIQUIDADO en
// comex/dashboard-exportaciones/colores.ts) — no son colores nuevos, es la
// paleta azul/verde ya establecida para "indicador principal" / "indicador
// positivo", reutilizada acá para que el acento combine con el resto de la app.
const PALETA_TOTAL = { titulo: "#376F96" };
const PALETA_APROVECHABLE = { titulo: "#397653" };

type FilaResumen = { modulo: string; variedad: string; aprovechableKg: number; nacionalKg: number; total: number };

type FilaDetalle = {
  id: string;
  placa: string;
  hora: string;
  variedad: string;
  modulo: string;
  turno: string;
  kg: number;
  jabas: number;
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
  resumen: FilaResumen[];
  detalle: FilaDetalle[];
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

  // Pedido explícito: los botones abren una VISTA (nueva pestaña), no
  // fuerzan la descarga automática. Importante: NO se abre una pestaña en
  // blanco primero para redirigirla después — los navegadores modernos
  // (Chrome/Edge/Safari) bloquean en silencio esa navegación tardía de una
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
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <Button variant="outline" size="sm" disabled={exportando !== null} onClick={() => verPng(refMateriaPrima)}>
            <Eye className="mr-2 h-4 w-4" />
            {exportando === "png" ? "Abriendo..." : "Ver PNG"}
          </Button>
          <Button variant="outline" size="sm" disabled={exportando !== null} onClick={() => verPdf(refMateriaPrima)}>
            <Eye className="mr-2 h-4 w-4" />
            {exportando === "pdf" ? "Abriendo..." : "Ver PDF"}
          </Button>
        </div>

        <div ref={refMateriaPrima} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <Encabezado titulo="Reporte de Recepción" subtitulo={subtitulo} cantidadIngresos={cantidadIngresos} />

          <div className="my-5 border-t" />

          <SeccionTitulo numero={1}>Indicadores generales</SeccionTitulo>
          {/* grid-cols-2 fijo (no grid-cols-1 en mobile): pedido explícito,
              ambas tarjetas deben leerse al mismo tiempo en celular — ver
              el padding/tipografía responsive de KPICard para que no se
              corten a ese ancho. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <KPICard
              label="Total recibido"
              value={`${formatNumero(materiaPrima.kgRecepcionado)} Kg`}
              paleta={PALETA_TOTAL}
              icon={Truck}
            />
            <KPICard
              label="Aprovechable"
              value={`${formatNumero(materiaPrima.kgAprovechable)} Kg (${formatPorcentaje(materiaPrima.pctAprovechable)})`}
              paleta={PALETA_APROVECHABLE}
              icon={Leaf}
            />
          </div>

          <div className="my-5 border-t" />

          <SeccionTitulo numero={2}>Resumen por variedad y módulo</SeccionTitulo>
          <ResumenVariedadModuloTabla resumen={materiaPrima.resumen} materiaPrima={materiaPrima} />

          <div className="my-5 border-t" />

          <SeccionTitulo numero={3}>Detalle de recepción</SeccionTitulo>
          <DetalleRecepcionTabla detalle={materiaPrima.detalle} />
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

// Headers con tinte (azul primario / verde) para distinguir de un vistazo
// qué columna es Aprovechable y cuál es Nacional — mismos tokens que el resto
// de la app: bg-primary (acento de marca) y bg-emerald-600 (ya usado como
// color de "Aprovechable" en esta misma pantalla, ver PALETA_APROVECHABLE).
function ResumenVariedadModuloTabla({ resumen, materiaPrima }: { resumen: FilaResumen[]; materiaPrima: MateriaPrima }) {
  if (resumen.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos en el filtro elegido.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="bg-muted/40">Variedad</TableHead>
            <TableHead className="bg-muted/40">Módulo</TableHead>
            <TableHead numeric className="bg-primary text-primary-foreground">
              Aprovechable (Kg)
            </TableHead>
            <TableHead numeric className="bg-emerald-600 text-white">
              Nacional (Kg)
            </TableHead>
            <TableHead numeric className="bg-primary text-primary-foreground">
              Total (Kg)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resumen.map((fila) => (
            <TableRow key={`${fila.modulo}__${fila.variedad}`}>
              <TableCell className="font-medium">{fila.variedad}</TableCell>
              <TableCell>{formatModuloCompacto(fila.modulo)}</TableCell>
              <TableCell numeric>{formatNumero(fila.aprovechableKg)}</TableCell>
              <TableCell numeric>{formatNumero(fila.nacionalKg)}</TableCell>
              <TableCell numeric className="font-semibold">
                {formatNumero(fila.total)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell colSpan={2}>TOTAL KG</TableCell>
            <TableCell numeric>{formatNumero(materiaPrima.kgAprovechable)}</TableCell>
            <TableCell numeric>{formatNumero(materiaPrima.kgNacionalCampo)}</TableCell>
            <TableCell numeric>{formatNumero(materiaPrima.kgRecepcionado)}</TableCell>
          </TableRow>
          <TableRow className="bg-muted/30 font-semibold">
            <TableCell colSpan={2}>PARTICIPACIÓN</TableCell>
            <TableCell numeric>{formatPorcentaje(materiaPrima.pctAprovechable)}</TableCell>
            <TableCell numeric>{formatPorcentaje(materiaPrima.pctNacionalCampo)}</TableCell>
            <TableCell numeric>100.0%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function DetalleRecepcionTabla({ detalle }: { detalle: FilaDetalle[] }) {
  if (detalle.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos en el filtro elegido.</p>;
  }
  const totalKg = detalle.reduce((acc, f) => acc + f.kg, 0);
  const totalJabas = detalle.reduce((acc, f) => acc + f.jabas, 0);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="bg-primary text-primary-foreground">Placa</TableHead>
            <TableHead className="bg-primary text-primary-foreground">Hora</TableHead>
            <TableHead className="bg-primary text-primary-foreground">Variedad</TableHead>
            <TableHead className="bg-primary text-primary-foreground">Módulo</TableHead>
            <TableHead className="bg-primary text-primary-foreground">Turno</TableHead>
            <TableHead numeric className="bg-primary text-primary-foreground">
              Kg
            </TableHead>
            <TableHead numeric className="bg-primary text-primary-foreground">
              Jabas
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detalle.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono font-medium">{f.placa}</TableCell>
              <TableCell>{f.hora}</TableCell>
              <TableCell>{f.variedad}</TableCell>
              <TableCell>{formatModuloCompacto(f.modulo)}</TableCell>
              <TableCell>{f.turno}</TableCell>
              <TableCell numeric>{formatNumero(f.kg)}</TableCell>
              <TableCell numeric>{f.jabas.toLocaleString("es-PE")}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell colSpan={5}>Total</TableCell>
            <TableCell numeric>{formatNumero(totalKg)}</TableCell>
            <TableCell numeric>{totalJabas.toLocaleString("es-PE")}</TableCell>
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
