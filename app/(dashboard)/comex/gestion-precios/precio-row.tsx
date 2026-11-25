"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { actualizarPrecioAction } from "@/lib/actions/gestion-precios-actions";
import { valorizar } from "@/lib/comex/valorizacion-precios";
import { formatDate, formatCantidad } from "@/lib/utils";
import type { TipoPrecio, UnidadPrecio } from "@prisma/client";

const UNIDAD_LABEL: Record<UnidadPrecio, string> = { USD_KG: "USD / Kg", USD_CAJA: "USD / Caja" };
const TIPO_PRECIO_LABEL: Record<TipoPrecio, string> = {
  FOB: "FOB",
  FREIGHT: "Freight",
  INTERNATIONAL_INSURANCE: "International Insurance",
  CIF: "CIF",
};

type Precio = {
  id: string;
  productoSku: string | null;
  variedad: string | null;
  precioUnitario: number;
  moneda: string;
  unidad: UnidadPrecio;
  incoterm: string | null;
  tipoPrecio: TipoPrecio;
  createdAt: Date;
  historial: { id: string; precioAnterior: number; precioNuevo: number; createdAt: Date }[];
};

export function PrecioRow({
  precio,
  cantidades,
}: {
  precio: Precio;
  cantidades: { totalKg: number | null; totalCajas: number | null };
}) {
  const [editando, setEditando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [nuevoPrecio, setNuevoPrecio] = useState(String(precio.precioUnitario));
  const [guardando, startGuardado] = useTransition();

  const valorizacion = valorizar(precio.unidad, precio.precioUnitario, cantidades);

  function guardar() {
    const valor = Number(nuevoPrecio);
    if (!(valor > 0)) {
      toast.error("Ingresa un precio válido.");
      return;
    }
    startGuardado(async () => {
      const resultado = await actualizarPrecioAction(precio.id, valor);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Precio actualizado");
      setEditando(false);
    });
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{TIPO_PRECIO_LABEL[precio.tipoPrecio]}</Badge>
            {precio.incoterm && <Badge variant="outline">{precio.incoterm}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {precio.productoSku ?? "Cualquier producto"} {precio.variedad ? `· ${precio.variedad}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">Registrado {formatDate(precio.createdAt)}</p>
        </div>

        <div className="text-right">
          {editando ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.0001"
                className="w-28"
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
              />
              <Button size="sm" onClick={guardar} disabled={guardando}>
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">
                {precio.moneda} {precio.precioUnitario.toFixed(4)} <span className="text-sm text-muted-foreground">({UNIDAD_LABEL[precio.unidad]})</span>
              </p>
              <Button size="icon" variant="ghost" onClick={() => setEditando(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {valorizacion
              ? `Valorizado: ${precio.moneda} ${formatCantidad(valorizacion.total)} (${formatCantidad(valorizacion.cantidad)} ${
                  precio.unidad === "USD_KG" ? "Kg" : "cajas"
                })`
              : `Sin ${precio.unidad === "USD_KG" ? "kg" : "cajas"} disponibles para valorizar`}
          </p>
        </div>
      </div>

      {precio.historial.length > 0 && (
        <div className="mt-2">
          <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setVerHistorial((v) => !v)}>
            <History className="h-3 w-3" />
            {verHistorial ? "Ocultar historial" : `Ver historial (${precio.historial.length})`}
          </button>
          {verHistorial && (
            <ul className="mt-2 space-y-1 border-l pl-3 text-xs text-muted-foreground">
              {precio.historial.map((h) => (
                <li key={h.id}>
                  {formatDate(h.createdAt)}: {precio.moneda} {h.precioAnterior.toFixed(4)} → {h.precioNuevo.toFixed(4)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
