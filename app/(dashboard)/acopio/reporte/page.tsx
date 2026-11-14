import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/db/prisma";
import { cn, rangoFechaCosecha, rangoSemanaISO, semanaISOConAnio } from "@/lib/utils";
import { ReporteAcopioView } from "./reporte-acopio-view";

export default async function ReporteAcopioPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; semana?: string }>;
}) {
  const { desde, hasta, semana: semanaParam } = await searchParams;

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
      where: fechaCosecha ? { ingresoFruta: { fechaCosecha } } : undefined,
      select: {
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

  // Matriz Kg recepcionado por Módulo × Variedad (Exportable + Descarte
  // Campo combinados: ambos tienen módulo en la base de datos).
  const modulosSet = new Set<string>();
  const variedadesSet = new Set<string>();
  const matrizPorModulo = new Map<string, Map<string, number>>();
  for (const l of lineasFruta) {
    modulosSet.add(l.modulo);
    variedadesSet.add(l.variedad);
    const porVariedad = matrizPorModulo.get(l.modulo) ?? new Map<string, number>();
    porVariedad.set(l.variedad, (porVariedad.get(l.variedad) ?? 0) + Number(l.pesoNetoKg));
    matrizPorModulo.set(l.modulo, porVariedad);
  }
  const modulosMatriz = Array.from(modulosSet).sort();
  const variedadesMatriz = Array.from(variedadesSet).sort();
  const filasMatriz = modulosMatriz.map((modulo) => {
    const porVariedad = matrizPorModulo.get(modulo)!;
    const valores = variedadesMatriz.map((v) => porVariedad.get(v) ?? 0);
    return { modulo, valores, total: valores.reduce((a, b) => a + b, 0) };
  });
  const totalesPorVariedadMatriz = variedadesMatriz.map((_, i) => filasMatriz.reduce((acc, f) => acc + f.valores[i], 0));
  const totalGeneralMatriz = totalesPorVariedadMatriz.reduce((a, b) => a + b, 0);

  // Control horario de recepción: una fila por VIAJE (un mismo IngresoFruta
  // puede tener varias líneas de pallet, ej. distinta variedad/módulo o
  // Exportable + Descarte Campo) — se agrupa por ingresoFrutaId y se suma
  // todo lo que trajo ese camión, sin importar su clasificación. Pedido
  // explícito: "considera todo lo que trajo el camión".
  type FilaViaje = { ingresoFrutaId: string; placa: string; hora: string; kg: number };
  const viajesPorId = new Map<string, FilaViaje>();
  for (const l of lineasFruta) {
    const existente = viajesPorId.get(l.ingresoFrutaId);
    const kg = Number(l.pesoNetoKg);
    if (existente) {
      existente.kg += kg;
    } else {
      viajesPorId.set(l.ingresoFrutaId, {
        ingresoFrutaId: l.ingresoFrutaId,
        placa: l.ingresoFruta.placaTransporte || "—",
        hora: l.ingresoFruta.horaIngreso || "—",
        kg,
      });
    }
  }
  const filasControlHorario = Array.from(viajesPorId.values()).sort((a, b) => a.hora.localeCompare(b.hora));
  const totalControlHorarioKg = filasControlHorario.reduce((acc, f) => acc + f.kg, 0);

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

  const hayFiltro = Boolean(desde || hasta || semanaParam);
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
          <Label htmlFor="semana">Semana de cosecha</Label>
          <select
            id="semana"
            name="semana"
            defaultValue={semanaParam ?? ""}
            className={cn(
              "flex h-10 w-[190px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
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
          <Label htmlFor="desde">Desde (fecha de cosecha)</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hasta">Hasta (fecha de cosecha)</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-[170px]" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
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
          cantidadIngresos={viajesPorId.size}
          materiaPrima={{
            kgAprovechable,
            jabasAprovechable,
            kgNacionalCampo,
            jabasNacionalCampo,
            kgRecepcionado,
            jabasRecepcionado,
            pctAprovechable,
            pctNacionalCampo,
            matriz: { modulos: modulosMatriz, variedades: variedadesMatriz, filas: filasMatriz, totalesPorVariedad: totalesPorVariedadMatriz, totalGeneral: totalGeneralMatriz },
            controlHorario: { filas: filasControlHorario, totalKg: totalControlHorarioKg },
          }}
          industrial={{ filas: filasIndustrial, totalKg: totalIndustrialKg, totalJabas: totalIndustrialJabas }}
        />
      )}
    </div>
  );
}
