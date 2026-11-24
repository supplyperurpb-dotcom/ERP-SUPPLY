import Link from "next/link";
import { BarChart3, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db/prisma";
import { cn, fechaLocalHoy, semanaISOConAnio } from "@/lib/utils";
import { obtenerDatosReporteRecepcion, resolverFechaCosechaFiltro } from "@/lib/acopio-reporte";
import { MODULOS_ACOPIO, VARIEDADES_COSECHA } from "@/lib/constants/modulos";
import { ReporteAcopioView } from "./reporte-acopio-view";
import { ReporteNavTabs } from "./reporte-nav-tabs";
import { FiltroRangoFecha } from "./filtro-rango-fecha";

// Filtro "Tipo de operación" (pedido explícito): acota IngresoFrutaPallet
// (Materia Prima) a Exportable o Descarte Campo — Industrial no tiene esta
// distinción (su tipoProducto es fijo "Descarte Planta"), así que el
// filtro no se aplica a esa pestaña.
const TIPOS_OPERACION = ["Exportable", "Descarte Campo"] as const;

export default async function ReporteAcopioPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    semana?: string;
    tipo?: string;
    campania?: string;
    modulo?: string;
    variedad?: string;
  }>;
}) {
  const {
    desde,
    hasta,
    semana: semanaParam,
    tipo: tipoParam,
    campania: campaniaParam,
    modulo: moduloParam,
    variedad: variedadParam,
  } = await searchParams;
  const tipoOperacion = TIPOS_OPERACION.includes(tipoParam as (typeof TIPOS_OPERACION)[number])
    ? (tipoParam as (typeof TIPOS_OPERACION)[number])
    : null;
  const modulo = MODULOS_ACOPIO.includes(moduloParam as (typeof MODULOS_ACOPIO)[number]) ? (moduloParam as string) : null;
  const variedad = VARIEDADES_COSECHA.includes(variedadParam as (typeof VARIEDADES_COSECHA)[number])
    ? (variedadParam as string)
    : null;

  // Pedido explícito: el filtro de fecha siempre arranca marcado en "hoy"
  // cuando no hay ningún otro filtro de fecha aplicado (ni desde/hasta, ni
  // semana, ni campaña) — no afecta si ya se eligió alguno de esos, ni si
  // solo se aplicó tipo/módulo/variedad (esos no son de fecha).
  const sinFiltroDeFecha = !desde && !hasta && !semanaParam && !campaniaParam;
  const desdeEfectivo = desde ?? (sinFiltroDeFecha ? fechaLocalHoy() : undefined);
  const hastaEfectivo = hasta ?? (sinFiltroDeFecha ? fechaLocalHoy() : undefined);

  const fechaCosecha = resolverFechaCosechaFiltro({
    desde: desdeEfectivo,
    hasta: hastaEfectivo,
    semana: semanaParam,
    campania: campaniaParam,
  });
  const campania = Number(campaniaParam);

  const [datosRecepcion, lineasIndustrial, fechasFruta, fechasIndustrial] = await Promise.all([
    obtenerDatosReporteRecepcion({ fechaCosecha, tipoOperacion, modulo, variedad }),
    // Reporte Industrial (segunda pestaña): IngresoIndustrialPallet no tiene
    // módulo/turno en la base de datos (solo Ingreso de Materia Prima los
    // tiene) — por eso su desglose es únicamente por variedad.
    prisma.ingresoIndustrialPallet.findMany({
      where: fechaCosecha ? { fechaCosecha } : undefined,
      select: {
        variedad: true,
        pesoNetoKg: true,
        cantidadBandejas: true,
        fechaCosecha: true,
      },
    }),
    // Universo completo de fechas de cosecha (sin aplicar el filtro actual)
    // para que el desplegable de semanas siempre muestre todas las semanas
    // con datos, no solo las del filtro ya aplicado.
    prisma.ingresoFruta.findMany({ select: { fechaCosecha: true }, distinct: ["fechaCosecha"] }),
    prisma.ingresoIndustrialPallet.findMany({ select: { fechaCosecha: true }, distinct: ["fechaCosecha"] }),
  ]);

  const semanasDisponiblesMap = new Map<string, { anio: number; semana: number }>();
  for (const { fechaCosecha: f } of [...fechasFruta, ...fechasIndustrial]) {
    const { anio, semana } = semanaISOConAnio(f);
    semanasDisponiblesMap.set(`${anio}-${semana}`, { anio, semana });
  }
  const semanasDisponibles = Array.from(semanasDisponiblesMap.entries())
    .map(([valor, datos]) => ({ valor, ...datos }))
    .sort((a, b) => a.anio - b.anio || a.semana - b.semana);
  const mostrarAnio = new Set(semanasDisponibles.map((s) => s.anio)).size > 1;

  // --- Pestaña 2: Recepción Industrial — únicamente por variedad (sin
  // módulo: IngresoIndustrialPallet no tiene ese campo en la base de datos).
  type FilaIndustrial = { variedad: string; kg: number; jabas: number };
  const industrialPorVariedad = new Map<string, FilaIndustrial>();
  for (const l of lineasIndustrial) {
    const existente = industrialPorVariedad.get(l.variedad) ?? { variedad: l.variedad, kg: 0, jabas: 0 };
    existente.kg += Number(l.pesoNetoKg);
    existente.jabas += l.cantidadBandejas;
    industrialPorVariedad.set(l.variedad, existente);
  }
  const filasIndustrial = Array.from(industrialPorVariedad.values()).sort((a, b) => a.variedad.localeCompare(b.variedad));
  const totalIndustrialKg = filasIndustrial.reduce((acc, f) => acc + f.kg, 0);
  const totalIndustrialJabas = filasIndustrial.reduce((acc, f) => acc + f.jabas, 0);

  const hayFiltro = Boolean(desde || hasta || semanaParam || tipoOperacion || campaniaParam || modulo || variedad);
  const semanaSeleccionada = semanaParam ? semanasDisponibles.find((s) => s.valor === semanaParam) ?? null : null;
  const sinDatos = datosRecepcion.detalle.length === 0 && lineasIndustrial.length === 0;
  const campaniaTexto = campaniaParam && Number.isFinite(campania) ? `Campaña ${campania}` : null;

  // Query string de los filtros actuales, para que "Generar Tarja PDF" abra
  // el PDF con exactamente lo que se está viendo en pantalla.
  const paramsPdf = new URLSearchParams();
  if (desdeEfectivo) paramsPdf.set("desde", desdeEfectivo);
  if (hastaEfectivo) paramsPdf.set("hasta", hastaEfectivo);
  if (semanaParam) paramsPdf.set("semana", semanaParam);
  if (tipoOperacion) paramsPdf.set("tipo", tipoOperacion);
  if (campaniaParam) paramsPdf.set("campania", campaniaParam);
  if (modulo) paramsPdf.set("modulo", modulo);
  if (variedad) paramsPdf.set("variedad", variedad);
  const pdfHref = `/api/pdf/reporte-recepcion?${paramsPdf.toString()}`;
  const generadoEn = new Date().toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <Link href="/acopio" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground print:hidden">
        ← Volver a Acopio
      </Link>

      <ReporteNavTabs />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 print:hidden">
        <div className="grid gap-1.5">
          <Label htmlFor="semana">Semana</Label>
          <select
            id="semana"
            name="semana"
            defaultValue={semanaParam ?? ""}
            className={cn(
              "flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <option value="">Todas las semanas</option>
            {semanasDisponibles.map((s) => (
              <option key={s.valor} value={s.valor}>
                Semana {s.semana}
                {mostrarAnio ? ` (${s.anio})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tipo">Tipo de operación</Label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipoOperacion ?? ""}
            className={cn(
              "flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <option value="">Todos</option>
            {TIPOS_OPERACION.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="campania">Campaña</Label>
          <Input id="campania" name="campania" type="number" defaultValue={campaniaParam ?? ""} placeholder="Año" className="w-[100px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="modulo">Módulo</Label>
          <select
            id="modulo"
            name="modulo"
            defaultValue={modulo ?? ""}
            className={cn(
              "flex h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <option value="">Todos</option>
            {MODULOS_ACOPIO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variedad">Variedad</Label>
          <select
            id="variedad"
            name="variedad"
            defaultValue={variedad ?? ""}
            className={cn(
              "flex h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <option value="">Todas</option>
            {VARIEDADES_COSECHA.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <FiltroRangoFecha desde={desdeEfectivo ?? ""} hasta={hastaEfectivo ?? ""} />
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" />
          Aplicar filtros
        </Button>
        {hayFiltro && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/reporte">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {sinDatos ? (
        <EmptyState
          icono={BarChart3}
          titulo="Todavía no hay datos para mostrar"
          descripcion="Registra ingresos en Ingreso de Materia Prima (y, si corresponde, en Ingreso Industrial Planta) para ver el resumen acá."
        />
      ) : (
        <ReporteAcopioView
          generadoEn={generadoEn}
          semanaTexto={semanaSeleccionada ? `Semana ${semanaSeleccionada.semana}${mostrarAnio ? ` (${semanaSeleccionada.anio})` : ""}` : "Todas las semanas"}
          campaniaTexto={campaniaTexto}
          rangoFechas={{ desde: desdeEfectivo ?? null, hasta: hastaEfectivo ?? null }}
          cantidadIngresos={datosRecepcion.cantidadIngresos}
          pdfHref={pdfHref}
          materiaPrima={datosRecepcion}
          industrial={{ filas: filasIndustrial, totalKg: totalIndustrialKg, totalJabas: totalIndustrialJabas }}
        />
      )}
    </div>
  );
}
