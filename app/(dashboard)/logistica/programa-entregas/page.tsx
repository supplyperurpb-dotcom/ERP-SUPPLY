import Link from "next/link";
import { CalendarClock, CalendarDays, DollarSign, Package, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FiltroRangoFecha } from "@/components/shared/filtro-rango-fecha";
import { KPICard } from "@/components/ui/cards/kpi-card";
import { formatMoneda } from "@/lib/utils";
import { obtenerEntregasProgramadas } from "@/lib/programa-entregas";
import { ProgramaEntregasView } from "./programa-entregas-view";

type SearchParams = {
  desde?: string;
  hasta?: string;
  busqueda?: string;
};

export default async function ProgramaEntregasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  const filas = await obtenerEntregasProgramadas({
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    busqueda: sp.busqueda || undefined,
  });

  // Tarjetas de resumen: siempre a partir del MISMO arreglo ya filtrado
  // (nunca una segunda consulta) para que tabla, tarjetas y calendario
  // nunca se desalineen entre sí.
  const hoyIso = new Date().toISOString().slice(0, 10);
  const productosDistintos = new Set(filas.map((f) => f.codigo)).size;
  const valorPorMoneda = new Map<string, number>();
  let entregasHoy = 0;
  let entregasPendientes = 0;
  for (const f of filas) {
    valorPorMoneda.set(f.moneda, (valorPorMoneda.get(f.moneda) ?? 0) + f.valor);
    const fechaIso = f.fechaTentativa.toISOString().slice(0, 10);
    if (fechaIso === hoyIso) entregasHoy++;
    if (fechaIso >= hoyIso) entregasPendientes++;
  }

  const hayFiltros = !!(sp.desde || sp.hasta || sp.busqueda);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Programa de Entregas"
        descripcion="Entregas programadas de las OC/OS ya aprobadas y liberadas totalmente, con su valorización — sin tener que entrar orden por orden."
      />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <FiltroRangoFecha desde={sp.desde ?? ""} hasta={sp.hasta ?? ""} label="Fecha tentativa" />
        <div className="grid min-w-[280px] flex-1 gap-1.5">
          <Label htmlFor="busqueda">Código, producto, proveedor o N.º de OC/OS</Label>
          <Input
            id="busqueda"
            name="busqueda"
            placeholder="Ej. NIXPRO, CROPS PROTECTION, OC-FO-000000001..."
            defaultValue={sp.busqueda ?? ""}
          />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="mr-2 h-4 w-4" />
          Filtrar
        </Button>
        {hayFiltros && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/logistica/programa-entregas">Limpiar</Link>
          </Button>
        )}
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Entregas" value={String(filas.length)} icon={CalendarDays} />
        <KPICard label="Productos distintos" value={String(productosDistintos)} icon={Package} />
        {[...valorPorMoneda.entries()].map(([moneda, valor]) => (
          <KPICard key={moneda} label={`Valor programado ${moneda}`} value={formatMoneda(valor, moneda)} icon={DollarSign} />
        ))}
        <KPICard label="Entregas de hoy" value={String(entregasHoy)} icon={CalendarClock} />
        <KPICard label="Entregas pendientes" value={String(entregasPendientes)} icon={CalendarClock} />
      </div>

      {filas.length === 0 ? (
        <EmptyState
          icono={CalendarDays}
          titulo={hayFiltros ? "No hay entregas que coincidan con esos filtros" : "Aún no hay entregas programadas"}
          descripcion={
            hayFiltros
              ? "Prueba con otros filtros."
              : "Aparecen acá en cuanto una OC/OS con programa de entregas quede aprobada y liberada totalmente."
          }
        />
      ) : (
        <ProgramaEntregasView filas={filas} />
      )}
    </div>
  );
}
