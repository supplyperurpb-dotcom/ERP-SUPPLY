import Link from "next/link";
import { CalendarClock, CalendarDays, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FiltroRangoFecha } from "@/components/shared/filtro-rango-fecha";
import { KPICard } from "@/components/ui/cards/kpi-card";
import { formatMoneda } from "@/lib/utils";
import { convertirAUsd, type MonedaCodigo } from "@/lib/constants/moneda";
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
  const productosHoy = new Set<string>();
  const productosPendientes = new Set<string>();
  let valorTotalUsd = 0;
  let entregasHoy = 0;
  let valorHoyUsd = 0;
  let entregasPendientes = 0;
  let valorPendientesUsd = 0;
  for (const f of filas) {
    const valorUsd = convertirAUsd(f.valor, f.moneda as MonedaCodigo);
    valorTotalUsd += valorUsd;
    const fechaIso = f.fechaTentativa.toISOString().slice(0, 10);
    if (fechaIso === hoyIso) {
      entregasHoy++;
      valorHoyUsd += valorUsd;
      productosHoy.add(f.codigo);
    }
    if (fechaIso >= hoyIso) {
      entregasPendientes++;
      valorPendientesUsd += valorUsd;
      productosPendientes.add(f.codigo);
    }
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
            placeholder="Ej. NIXPRO, CROPS PROTECTION, OC-000004660..."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          label="Entregas"
          value={String(filas.length)}
          valueSuffix={formatMoneda(valorTotalUsd, "USD")}
          secondaryLine={`${productosDistintos} producto${productosDistintos === 1 ? "" : "s"}`}
          icon={CalendarDays}
        />
        <KPICard
          label="Entregas para Hoy"
          value={String(entregasHoy)}
          valueSuffix={formatMoneda(valorHoyUsd, "USD")}
          secondaryLine={`${productosHoy.size} producto${productosHoy.size === 1 ? "" : "s"}`}
          icon={CalendarClock}
        />
        <KPICard
          label="Entregas Pendientes"
          value={String(entregasPendientes)}
          valueSuffix={formatMoneda(valorPendientesUsd, "USD")}
          secondaryLine={`${productosPendientes.size} producto${productosPendientes.size === 1 ? "" : "s"}`}
          icon={CalendarClock}
        />
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
