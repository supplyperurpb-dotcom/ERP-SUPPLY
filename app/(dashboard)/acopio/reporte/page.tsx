import Link from "next/link";
import { BarChart3, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db/prisma";
import { cn, rangoFechaCosecha, rangoSemanaISO, semanaISOConAnio } from "@/lib/utils";
import { ReporteAcopioView } from "./reporte-acopio-view";

// Filtro "Tipo de operación" (pedido explícito): acota IngresoFrutaPallet
// (Materia Prima) a Exportable o Descarte Campo — Industrial no tiene esta
// distinción (su tipoProducto es fijo "Descarte Planta"), así que el
// filtro no se aplica a esa pestaña.
const TIPOS_OPERACION = ["Exportable", "Descarte Campo"] as const;

export default async function ReporteAcopioPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; semana?: string; tipo?: string }>;
}) {
  const { desde, hasta, semana: semanaParam, tipo: tipoParam } = await searchParams;
  const tipoOperacion = TIPOS_OPERACION.includes(tipoParam as (typeof TIPOS_OPERACION)[number])
    ? (tipoParam as (typeof TIPOS_OPERACION)[number])
    : null;

  let fechaCosecha = rangoFechaCosecha(desde, hasta);
  const [anioFiltro, semanaFiltro] = (semanaParam ?? "").split("-").map(Number);
  if (semanaParam && Number.isFinite(anioFiltro) && Number.isFinite(semanaFiltro)) {
    const rangoSemana = rangoSemanaISO(anioFiltro, semanaFiltro);
    fechaCosecha = {
      gte: fechaCosecha?.gte && fechaCosecha.gte > rangoSemana.gte ? fechaCosecha.gte : rangoSemana.gte,
      lte: fechaCosecha?.lte && fechaCosecha.lte < rangoSemana.lte ? fechaCosecha.lte : rangoSemana.lte,
    };
  }

  const [lineasFruta, lineasIndustrial, fechasFruta, fechasIndustrial] = await Promise.all([
    prisma.ingresoFrutaPallet.findMany({
      where: {
        ...(fechaCosecha ? { ingresoFruta: { fechaCosecha } } : {}),
        ...(tipoOperacion ? { tipoProducto: tipoOperacion } : {}),
      },
      select: {
        id: true,
        ingresoFrutaId: true,
        variedad: true,
        modulo: true,
        turno: true,
        tipoProducto: true,
        pesoNetoKg: true,
        cantidadBandejas: true,
        ingresoFruta: { select: { fechaCosecha: true, placaTransporte: true, horaIngreso: true } },
      },
    }),
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

  // --- Pestaña 1: Materia Prima (Exportable + Descarte Campo). Pedido
  // explícito: este reporte es solo de Ingreso de Materia Prima, así que
  // acá "Nacional Campo" = Descarte Campo únicamente (no se suma Industrial,
  // que tiene su propia pestaña separada).
  const lineasAprovechable = lineasFruta.filter((l) => l.tipoProducto === "Exportable");
  const lineasNacionalCampo = lineasFruta.filter((l) => l.tipoProducto === "Descarte Campo");

  const kgAprovechable = lineasAprovechable.reduce((acc, l) => acc + Number(l.pesoNetoKg), 0);
  const jabasAprovechable = lineasAprovechable.reduce((acc, l) => acc + l.cantidadBandejas, 0);
  const kgNacionalCampo = lineasNacionalCampo.reduce((acc, l) => acc + Number(l.pesoNetoKg), 0);
  const jabasNacionalCampo = lineasNacionalCampo.reduce((acc, l) => acc + l.cantidadBandejas, 0);
  const kgRecepcionado = kgAprovechable + kgNacionalCampo;
  const jabasRecepcionado = jabasAprovechable + jabasNacionalCampo;
  const pctAprovechable = kgRecepcionado > 0 ? (kgAprovechable / kgRecepcionado) * 100 : 0;
  const pctNacionalCampo = kgRecepcionado > 0 ? (kgNacionalCampo / kgRecepcionado) * 100 : 0;

  // --- Sección "2. Resumen por variedad y módulo" (pedido explícito, calca
  // la estructura del reporte de referencia): una fila por combinación
  // módulo+variedad, con el Kg desglosado en Aprovechable (Exportable) y
  // Nacional (Descarte Campo) — no un pivot de variedades como columnas.
  type FilaResumen = { modulo: string; variedad: string; aprovechableKg: number; nacionalKg: number; total: number };
  const resumenPorModuloVariedad = new Map<string, FilaResumen>();
  for (const l of lineasFruta) {
    const clave = `${l.modulo}__${l.variedad}`;
    const fila = resumenPorModuloVariedad.get(clave) ?? { modulo: l.modulo, variedad: l.variedad, aprovechableKg: 0, nacionalKg: 0, total: 0 };
    const kg = Number(l.pesoNetoKg);
    if (l.tipoProducto === "Exportable") fila.aprovechableKg += kg;
    else fila.nacionalKg += kg;
    fila.total += kg;
    resumenPorModuloVariedad.set(clave, fila);
  }
  const filasResumen = Array.from(resumenPorModuloVariedad.values()).sort(
    (a, b) => a.modulo.localeCompare(b.modulo) || a.variedad.localeCompare(b.variedad)
  );

  // --- Sección "3. Detalle de recepción": una fila por LÍNEA de pallet
  // (no agrupada por viaje) con su placa/hora/variedad/módulo/turno/kg/jabas,
  // igual que el reporte de referencia.
  const filasDetalle = lineasFruta
    .map((l) => ({
      id: l.id,
      placa: l.ingresoFruta.placaTransporte || "—",
      hora: l.ingresoFruta.horaIngreso || "—",
      variedad: l.variedad,
      modulo: l.modulo,
      turno: l.turno,
      kg: Number(l.pesoNetoKg),
      jabas: l.cantidadBandejas,
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

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

  const cantidadIngresos = new Set(lineasFruta.map((l) => l.ingresoFrutaId)).size;
  const hayFiltro = Boolean(desde || hasta || semanaParam || tipoOperacion);
  const semanaSeleccionada = semanaParam ? semanasDisponibles.find((s) => s.valor === semanaParam) ?? null : null;
  const sinDatos = lineasFruta.length === 0 && lineasIndustrial.length === 0;
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
          <Label htmlFor="desde">Fecha de cosecha</Label>
          <div className="flex items-center gap-2">
            <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-[150px]" />
            <span className="text-sm text-muted-foreground">a</span>
            <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-[150px]" />
          </div>
        </div>
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
          rangoFechas={{ desde: desde ?? null, hasta: hasta ?? null }}
          cantidadIngresos={cantidadIngresos}
          materiaPrima={{
            kgAprovechable,
            jabasAprovechable,
            kgNacionalCampo,
            jabasNacionalCampo,
            kgRecepcionado,
            jabasRecepcionado,
            pctAprovechable,
            pctNacionalCampo,
            resumen: filasResumen,
            detalle: filasDetalle,
          }}
          industrial={{ filas: filasIndustrial, totalKg: totalIndustrialKg, totalJabas: totalIndustrialJabas }}
        />
      )}
    </div>
  );
}
