import Link from "next/link";
import { CalendarClock, CalendarDays, DollarSign, Package, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiltroRangoFecha } from "@/components/shared/filtro-rango-fecha";
import { KPICard } from "@/components/ui/cards/kpi-card";
import { formatMoneda } from "@/lib/utils";
import { obtenerEntregasProgramadas } from "@/lib/programa-entregas";
import { ProgramaEntregasView } from "./programa-entregas-view";
import type { EstadoDocumento, EstadoEntregaProgramada } from "@prisma/client";

const ESTADOS_OC: { valor: EstadoDocumento; nombre: string }[] = [
  { valor: "BORRADOR", nombre: "Borrador" },
  { valor: "PENDIENTE", nombre: "Pendiente VB" },
  { valor: "APROBADO", nombre: "Aprobada" },
  { valor: "RECHAZADO", nombre: "Rechazada" },
  { valor: "ANULADO", nombre: "Anulada" },
];

const ESTADOS_ENTREGA: { valor: EstadoEntregaProgramada; nombre: string }[] = [
  { valor: "PROGRAMADA", nombre: "Programada" },
  { valor: "ANULADA", nombre: "Anulada" },
];

type SearchParams = {
  desde?: string;
  hasta?: string;
  producto?: string;
  proveedor?: string;
  numeroOC?: string;
  estadoOC?: string;
  estadoEntrega?: string;
};

export default async function ProgramaEntregasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const estadoOC = sp.estadoOC && sp.estadoOC !== "__todos__" ? (sp.estadoOC as EstadoDocumento) : undefined;
  const estadoEntrega =
    sp.estadoEntrega && sp.estadoEntrega !== "__todos__" ? (sp.estadoEntrega as EstadoEntregaProgramada) : undefined;

  const filas = await obtenerEntregasProgramadas({
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    producto: sp.producto || undefined,
    proveedor: sp.proveedor || undefined,
    numeroOC: sp.numeroOC || undefined,
    estadoOC,
    estadoEntrega,
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
    // "Pendiente" = programada y con fecha tentativa todavía no vencida.
    if (f.estadoEntrega === "PROGRAMADA" && fechaIso >= hoyIso) entregasPendientes++;
  }

  const hayFiltros = !!(sp.desde || sp.hasta || sp.producto || sp.proveedor || sp.numeroOC || estadoOC || estadoEntrega);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Programa de Entregas"
        descripcion="Todas las entregas programadas de todas las OC/OS, con su valorización — sin tener que entrar orden por orden."
      />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <FiltroRangoFecha desde={sp.desde ?? ""} hasta={sp.hasta ?? ""} label="Fecha tentativa" />
        <div className="grid gap-1.5">
          <Label htmlFor="producto">Producto</Label>
          <Input id="producto" name="producto" placeholder="Código o descripción" defaultValue={sp.producto ?? ""} className="w-48" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="proveedor">Proveedor</Label>
          <Input id="proveedor" name="proveedor" placeholder="Razón social" defaultValue={sp.proveedor ?? ""} className="w-48" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="numeroOC">N.º de OC/OS</Label>
          <Input id="numeroOC" name="numeroOC" placeholder="OC-FO-..." defaultValue={sp.numeroOC ?? ""} className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label>Estado OC/OS</Label>
          <Select name="estadoOC" defaultValue={sp.estadoOC ?? "__todos__"}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              {ESTADOS_OC.map((e) => (
                <SelectItem key={e.valor} value={e.valor}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Estado programa</Label>
          <Select name="estadoEntrega" defaultValue={sp.estadoEntrega ?? "__todos__"}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              {ESTADOS_ENTREGA.map((e) => (
                <SelectItem key={e.valor} value={e.valor}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              : "Se registran automáticamente al generar una OC/OS, en el paso Programa de Entregas."
          }
        />
      ) : (
        <ProgramaEntregasView filas={filas} />
      )}
    </div>
  );
}
