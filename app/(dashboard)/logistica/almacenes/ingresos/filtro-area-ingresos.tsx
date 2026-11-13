"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREAS_SOLPED, type AreaSolpedCodigo } from "@/lib/constants/compras";

const SIN_FILTRO = "__sin_filtro__";

// Filtra la lista de Ingresos por el Área que solicitó el producto (ver
// IngresoAlmacenItem.areaDetalle) — jalado de la Solicitud de Pedido
// detrás de la OC, para poder ver qué stock le pertenece a cada área.
export function FiltroAreaIngresos({ areaDetalleActual }: { areaDetalleActual?: AreaSolpedCodigo }) {
  const router = useRouter();

  return (
    <div className="max-w-xs space-y-2">
      <Label>Filtrar por área solicitante</Label>
      <Select
        value={areaDetalleActual ?? SIN_FILTRO}
        onValueChange={(valor) => {
          const params = new URLSearchParams();
          if (valor !== SIN_FILTRO) params.set("areaDetalle", valor);
          const query = params.toString();
          router.push(`/logistica/almacenes/ingresos${query ? `?${query}` : ""}`);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_FILTRO}>Todas las áreas</SelectItem>
          {AREAS_SOLPED.map((a) => (
            <SelectItem key={a.valor} value={a.valor}>
              {a.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
