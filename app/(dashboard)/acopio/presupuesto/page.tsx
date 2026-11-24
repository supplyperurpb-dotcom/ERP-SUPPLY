import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { serializar } from "@/lib/utils";
import { VARIEDADES_COSECHA, SEMANA_MIN_COSECHA, SEMANA_MAX_COSECHA } from "@/lib/constants/modulos";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PresupuestoVariedadForm } from "./presupuesto-variedad-form";
import { PresupuestoSemanalForm } from "./presupuesto-semanal-form";

// Hectáreas conocidas de la temporada 2026 (dadas por el usuario) — solo se
// usan como valor inicial si todavía no hay una fila guardada para esa
// variedad/año, nunca pisan un valor ya guardado.
const HECTAREAS_INICIALES: Record<string, number> = {
  ARANA: 7.99,
  RAYMI: 46.15,
  ROSITA: 40.45,
  BREEZE: 0.47,
  CASCADE: 0.81,
};

export default async function PresupuestoCosechaPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    redirect("/inicio");
  }

  const { anio: anioParam } = await searchParams;
  const anio = Number(anioParam) || new Date().getFullYear();

  const [semanalDb, variedadDb] = await Promise.all([
    prisma.presupuestoCosechaSemana.findMany({ where: { anio } }),
    prisma.presupuestoCosechaVariedad.findMany({ where: { anio } }),
  ]);
  const [semanal, variedad] = serializar([semanalDb, variedadDb]);

  const semanalPorClave = new Map(semanal.map((f) => [`${f.semana}__${f.variedad}`, f]));
  const variedadPorNombre = new Map(variedad.map((f) => [f.variedad, f]));

  const filasSemanal = [];
  for (let semana = SEMANA_MIN_COSECHA; semana <= SEMANA_MAX_COSECHA; semana++) {
    for (const v of VARIEDADES_COSECHA) {
      const existente = semanalPorClave.get(`${semana}__${v}`);
      filasSemanal.push({
        semana,
        variedad: v,
        kgBudget: existente ? Number(existente.kgBudget) : null,
        kgOct: existente ? Number(existente.kgOct) : null,
      });
    }
  }

  const filasVariedad = VARIEDADES_COSECHA.map((v) => {
    const existente = variedadPorNombre.get(v);
    return { variedad: v, hectareas: existente ? Number(existente.hectareas) : (HECTAREAS_INICIALES[v] ?? null) };
  });

  return (
    <div>
      <Link href="/acopio/reporte/general" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Volver al Reporte de Acopio
      </Link>

      <PageHeader
        titulo="Presupuesto de cosecha"
        descripcion="Presupuesto semanal (KG Budget) y reproyección de octubre (KG Oct) por variedad, más hectáreas por variedad — alimenta el Reporte de Acopio › General."
      />

      <form className="mb-6 flex items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="anio">Año</Label>
          <Input id="anio" name="anio" type="number" defaultValue={anio} className="w-[120px]" />
        </div>
        <Button type="submit" variant="outline">
          Cambiar año
        </Button>
      </form>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Hectáreas por variedad</h2>
          <PresupuestoVariedadForm anio={anio} filas={filasVariedad} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Presupuesto semanal (Semana {SEMANA_MIN_COSECHA}–{SEMANA_MAX_COSECHA})
          </h2>
          <PresupuestoSemanalForm anio={anio} filas={filasSemanal} />
        </section>
      </div>
    </div>
  );
}
