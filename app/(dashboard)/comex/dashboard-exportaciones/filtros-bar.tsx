import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FiltrosFacturacion, OpcionesFiltro } from "@/lib/facturacion-exportacion";

const TODOS = "__todos__";

// Barra de filtros: fecha (rango), cliente y destino — pura UI controlada,
// las opciones de cada select vienen de obtenerOpcionesFiltro (lib), nunca
// de una lista fija acá.
export function FiltrosBar({
  filtros,
  opciones,
  onChange,
  onLimpiar,
}: {
  filtros: FiltrosFacturacion;
  opciones: OpcionesFiltro;
  onChange: (filtros: FiltrosFacturacion) => void;
  onLimpiar: () => void;
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="fechaDesde">Fecha desde</Label>
          <Input
            id="fechaDesde"
            type="date"
            min={opciones.fechaMin ?? undefined}
            max={opciones.fechaMax ?? undefined}
            value={filtros.fechaDesde ?? ""}
            onChange={(e) => onChange({ ...filtros, fechaDesde: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaHasta">Fecha hasta</Label>
          <Input
            id="fechaHasta"
            type="date"
            min={opciones.fechaMin ?? undefined}
            max={opciones.fechaMax ?? undefined}
            value={filtros.fechaHasta ?? ""}
            onChange={(e) => onChange({ ...filtros, fechaHasta: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select
            value={filtros.customer ?? TODOS}
            onValueChange={(v) => onChange({ ...filtros, customer: v === TODOS ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opciones.customers.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Mercado</Label>
          <Select
            value={filtros.market ?? TODOS}
            onValueChange={(v) => onChange({ ...filtros, market: v === TODOS ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opciones.markets.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Destino</Label>
          <Select
            value={filtros.destinationCountry ?? TODOS}
            onValueChange={(v) => onChange({ ...filtros, destinationCountry: v === TODOS ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {opciones.destinations.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <Button type="button" variant="outline" size="sm" onClick={onLimpiar}>
            Limpiar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
