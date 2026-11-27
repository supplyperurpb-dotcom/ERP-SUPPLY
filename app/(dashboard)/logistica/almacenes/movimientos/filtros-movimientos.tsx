"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FiltroRangoFecha } from "@/components/shared/filtro-rango-fecha";
import type { TipoMovimientoGlobal } from "@/lib/stock-almacen";

const TIPO_LABEL: Record<TipoMovimientoGlobal, string> = {
  INGRESO: "Ingreso",
  CONSUMO: "Consumo",
  TRASLADO: "Traslado",
  DEVOLUCION: "Devolución",
};

type Filtros = {
  proveedorId?: string;
  numero?: string;
  tipo?: TipoMovimientoGlobal;
  desde?: string;
  hasta?: string;
};

const TODOS = "__todos__";

// Mismo patrón que FiltrosTrazabilidadBar (reportes-trazabilidad): arma la
// URL en el cliente (para poder usar los Select de shadcn, que no sirven
// dentro de un <form> GET plano) y navega — queda bookmarkeable/compartible.
export function FiltrosMovimientosBar({
  valores,
  proveedores,
}: {
  valores: Filtros;
  proveedores: { id: string; razonSocial: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Filtros>(valores);

  function actualizar<K extends keyof Filtros>(campo: K, valor: Filtros[K]) {
    setForm((actual) => ({ ...actual, [campo]: valor || undefined }));
  }

  function aplicar() {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(form)) {
      if (valor) params.set(clave, valor);
    }
    router.push(`/logistica/almacenes/movimientos${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function limpiar() {
    setForm({});
    router.push("/logistica/almacenes/movimientos");
  }

  const hayFiltro = Object.values(valores).some(Boolean);

  return (
    <div className="mb-6 space-y-3 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="numero">N.º de movimiento</Label>
          <Input
            id="numero"
            placeholder="Ej. IA-0001"
            value={form.numero ?? ""}
            onChange={(e) => actualizar("numero", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Proveedor</Label>
          <Select value={form.proveedorId ?? TODOS} onValueChange={(v) => actualizar("proveedorId", v === TODOS ? undefined : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.razonSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Tipo de movimiento</Label>
          <Select
            value={form.tipo ?? TODOS}
            onValueChange={(v) => actualizar("tipo", v === TODOS ? undefined : (v as TipoMovimientoGlobal))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {(Object.keys(TIPO_LABEL) as TipoMovimientoGlobal[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FiltroRangoFecha
          desde={form.desde ?? ""}
          hasta={form.hasta ?? ""}
          onChange={({ desde, hasta }) => setForm((actual) => ({ ...actual, desde: desde || undefined, hasta: hasta || undefined }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={aplicar}>
          Filtrar
        </Button>
        {hayFiltro && (
          <Button type="button" variant="ghost" onClick={limpiar}>
            Limpiar filtro
          </Button>
        )}
      </div>
    </div>
  );
}
