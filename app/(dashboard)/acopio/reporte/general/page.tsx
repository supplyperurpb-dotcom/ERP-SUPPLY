import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { semanaISOConAnio } from "@/lib/utils";
import { VARIEDADES_COSECHA, SEMANA_MIN_COSECHA, SEMANA_MAX_COSECHA } from "@/lib/constants/modulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReporteNavTabs } from "../reporte-nav-tabs";
import { ReporteGeneralView } from "./reporte-general-view";

type AcumuladoVariedad = { variedad: string; aprovechableKg: number; nacionalKg: number; totalKg: number };
type ResumenSemanal = { semana: number; variedad: string; aprovechableKg: number; nacionalKg: number; totalKg: number };

export default async function ReporteAcopioGeneralPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio: anioParam } = await searchParams;
  const anio = Number(anioParam) || new Date().getFullYear();
  const rangoAnio = { gte: new Date(Date.UTC(anio, 0, 1)), lte: new Date(Date.UTC(anio, 11, 31, 23, 59, 59, 999)) };

  const [lineasFruta, lineasIndustrial, presupuestoSemanal, presupuestoVariedad, usuario] = await Promise.all([
    prisma.ingresoFrutaPallet.findMany({
      where: { ingresoFruta: { fechaCosecha: rangoAnio } },
      select: { variedad: true, tipoProducto: true, pesoNetoKg: true, ingresoFruta: { select: { fechaCosecha: true } } },
    }),
    prisma.ingresoIndustrialPallet.findMany({
      where: { fechaCosecha: rangoAnio },
      select: { variedad: true, pesoNetoKg: true, fechaCosecha: true },
    }),
    prisma.presupuestoCosechaSemana.findMany({ where: { anio } }),
    prisma.presupuestoCosechaVariedad.findMany({ where: { anio } }),
    getUsuarioActual(),
  ]);

  // --- Acumulado real por semana+variedad (Materia Prima: Exportable =
  // aprovechable, Descarte Campo = nacional; Industrial siempre nacional,
  // ya que esta vista sí lo incluye a diferencia del Reporte diario).
  const porSemanaVariedad = new Map<string, ResumenSemanal>();
  function sumar(semana: number, variedad: string, aprovechableKg: number, nacionalKg: number) {
    const clave = `${semana}__${variedad}`;
    const fila = porSemanaVariedad.get(clave) ?? { semana, variedad, aprovechableKg: 0, nacionalKg: 0, totalKg: 0 };
    fila.aprovechableKg += aprovechableKg;
    fila.nacionalKg += nacionalKg;
    fila.totalKg += aprovechableKg + nacionalKg;
    porSemanaVariedad.set(clave, fila);
  }
  for (const l of lineasFruta) {
    const { semana } = semanaISOConAnio(l.ingresoFruta.fechaCosecha);
    const kg = Number(l.pesoNetoKg);
    sumar(semana, l.variedad, l.tipoProducto === "Exportable" ? kg : 0, l.tipoProducto === "Exportable" ? 0 : kg);
  }
  for (const l of lineasIndustrial) {
    const { semana } = semanaISOConAnio(l.fechaCosecha);
    sumar(semana, l.variedad, 0, Number(l.pesoNetoKg));
  }

  // --- Tabla 1 "Acumulado por variedad": suma de todas las semanas.
  const acumuladoPorVariedad = new Map<string, AcumuladoVariedad>();
  for (const v of VARIEDADES_COSECHA) acumuladoPorVariedad.set(v, { variedad: v, aprovechableKg: 0, nacionalKg: 0, totalKg: 0 });
  for (const fila of porSemanaVariedad.values()) {
    const acc = acumuladoPorVariedad.get(fila.variedad) ?? { variedad: fila.variedad, aprovechableKg: 0, nacionalKg: 0, totalKg: 0 };
    acc.aprovechableKg += fila.aprovechableKg;
    acc.nacionalKg += fila.nacionalKg;
    acc.totalKg += fila.totalKg;
    acumuladoPorVariedad.set(fila.variedad, acc);
  }
  const filasAcumulado = VARIEDADES_COSECHA.map((v) => acumuladoPorVariedad.get(v)!);

  // --- Presupuesto semanal (Budget/Oct) por semana+variedad, para el
  // cálculo de Kg Proyectado y para la tabla/gráfico de Kg vs. Presupuesto.
  const presupuestoPorClave = new Map(presupuestoSemanal.map((p) => [`${p.semana}__${p.variedad}`, p]));
  const hectareasPorVariedad = new Map(presupuestoVariedad.map((p) => [p.variedad, Number(p.hectareas)]));

  // --- Tabla 2 "Rendimiento por variedad": Kg Proyectado = recorriendo
  // cada semana de la campaña, lo ya cosechado si existe, si no el KG Oct
  // pendiente (pedido explícito del usuario: "la proyección total es lo
  // cosechado + lo pendiente por cosechar").
  const filasRendimiento = VARIEDADES_COSECHA.map((variedad) => {
    const hectareas = hectareasPorVariedad.get(variedad) ?? 0;
    const kgEjec = acumuladoPorVariedad.get(variedad)?.totalKg ?? 0;
    let kgProy = 0;
    for (let semana = SEMANA_MIN_COSECHA; semana <= SEMANA_MAX_COSECHA; semana++) {
      const real = porSemanaVariedad.get(`${semana}__${variedad}`)?.totalKg ?? 0;
      if (real > 0) {
        kgProy += real;
      } else {
        kgProy += Number(presupuestoPorClave.get(`${semana}__${variedad}`)?.kgOct ?? 0);
      }
    }
    return { variedad, hectareas, kgEjec, kgProy };
  });
  const hectareasTotal = filasRendimiento.reduce((acc, f) => acc + f.hectareas, 0);

  // --- Tabla 3 "Resumen semanal aprovechable/nacional por variedad": todas
  // las combinaciones semana+variedad con algo de dato real, más recientes
  // primero.
  const filasResumenSemanal = Array.from(porSemanaVariedad.values())
    .filter((f) => f.totalKg > 0)
    .sort((a, b) => b.semana - a.semana || a.variedad.localeCompare(b.variedad));

  // --- Tabla 4 + gráfico "Kg cosechados vs. presupuesto": por semana,
  // sumando las 5 variedades.
  const filasPorSemana = [];
  for (let semana = SEMANA_MIN_COSECHA; semana <= SEMANA_MAX_COSECHA; semana++) {
    let kgReal = 0;
    let kgBudget = 0;
    let kgOct = 0;
    for (const variedad of VARIEDADES_COSECHA) {
      kgReal += porSemanaVariedad.get(`${semana}__${variedad}`)?.totalKg ?? 0;
      const p = presupuestoPorClave.get(`${semana}__${variedad}`);
      kgBudget += Number(p?.kgBudget ?? 0);
      kgOct += Number(p?.kgOct ?? 0);
    }
    if (kgReal === 0 && kgBudget === 0 && kgOct === 0) continue;
    filasPorSemana.push({ semana, kgReal, kgBudget, kgOct, pctAvance: kgOct > 0 ? (kgReal / kgOct) * 100 : 0 });
  }

  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;

  return (
    <div>
      <Link href="/acopio" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground print:hidden">
        ← Volver a Acopio
      </Link>

      <ReporteNavTabs />

      <form className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-4 print:hidden">
        <div className="grid gap-1.5">
          <Label htmlFor="anio">Año</Label>
          <Input id="anio" name="anio" type="number" defaultValue={anio} className="w-[120px]" />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline">
            Aplicar
          </Button>
          {esAdmin && (
            <Button type="button" variant="ghost" asChild>
              <Link href="/acopio/presupuesto">Editar presupuesto</Link>
            </Button>
          )}
        </div>
      </form>

      <ReporteGeneralView
        acumulado={filasAcumulado}
        rendimiento={filasRendimiento}
        hectareasTotal={hectareasTotal}
        resumenSemanal={filasResumenSemanal}
        presupuestoSemanal={filasPorSemana}
      />
    </div>
  );
}
