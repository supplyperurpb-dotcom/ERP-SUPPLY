import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelectFiltro } from "./multi-select-filtro";
import type { FiltrosFacturacion, OpcionesFiltro } from "@/lib/facturacion-exportacion";

// Barra de filtros: semana de despacho, mercado y destino — cada uno es un
// multi-select (casillas) para poder filtrar en bloque, ej. 3 semanas o 2
// mercados a la vez. Las opciones de cada select vienen de
// obtenerOpcionesFiltro (lib), nunca de una lista fija acá.
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
      <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Semana de despacho</Label>
          <MultiSelectFiltro
            etiqueta="semanas"
            opciones={opciones.weeks.map(String)}
            seleccionados={(filtros.weeks ?? []).map(String)}
            onChange={(valores) => onChange({ ...filtros, weeks: valores.map(Number) })}
          />
        </div>
        <div className="space-y-2">
          <Label>Mercado</Label>
          <MultiSelectFiltro
            etiqueta="mercados"
            opciones={opciones.markets}
            seleccionados={filtros.markets ?? []}
            onChange={(valores) => onChange({ ...filtros, markets: valores })}
          />
        </div>
        <div className="space-y-2">
          <Label>Destino</Label>
          <MultiSelectFiltro
            etiqueta="destinos"
            opciones={opciones.destinations}
            seleccionados={filtros.destinationCountries ?? []}
            onChange={(valores) => onChange({ ...filtros, destinationCountries: valores })}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" size="sm" onClick={onLimpiar}>
            Limpiar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
