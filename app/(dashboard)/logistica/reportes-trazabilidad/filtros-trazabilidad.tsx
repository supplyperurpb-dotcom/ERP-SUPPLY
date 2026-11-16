"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADO_ATENCION_LABEL, type EstadoAtencionLinea, type FiltrosTrazabilidad } from "@/lib/trazabilidad";

// Filtro dinámico (pedido explícito): se arma la URL con los campos no
// vacíos y se navega — mismo resultado bookmarkeable/compartible que un
// <form> GET, pero permite usar los Select de shadcn (no son controles
// nativos, no sirven dentro de un <form> GET plano).
export function FiltrosTrazabilidadBar({
  valores,
  opciones,
}: {
  valores: FiltrosTrazabilidad;
  opciones: { familias: string[]; subfamilias: string[] };
}) {
  const router = useRouter();
  const [form, setForm] = useState<FiltrosTrazabilidad>(valores);

  function actualizar<K extends keyof FiltrosTrazabilidad>(campo: K, valor: FiltrosTrazabilidad[K]) {
    setForm((actual) => ({ ...actual, [campo]: valor || undefined }));
  }

  function aplicar() {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(form)) {
      if (valor) params.set(clave, valor);
    }
    router.push(`/logistica/reportes-trazabilidad${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function limpiar() {
    setForm({});
    router.push("/logistica/reportes-trazabilidad");
  }

  const hayFiltro = Object.values(valores).some(Boolean);

  return (
    <div className="mb-6 space-y-3 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="requerimiento">Requerimiento</Label>
          <Input
            id="requerimiento"
            placeholder="Ej. SP-000000001"
            value={form.requerimiento ?? ""}
            onChange={(e) => actualizar("requerimiento", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            placeholder="Código de artículo"
            value={form.codigo ?? ""}
            onChange={(e) => actualizar("codigo", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ordenCompra">Orden de compra</Label>
          <Input
            id="ordenCompra"
            placeholder="Ej. OC-FO-000000001"
            value={form.ordenCompra ?? ""}
            onChange={(e) => actualizar("ordenCompra", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="proveedor">Proveedor</Label>
          <Input
            id="proveedor"
            placeholder="Razón social"
            value={form.proveedor ?? ""}
            onChange={(e) => actualizar("proveedor", e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Familia</Label>
          <Select value={form.familia ?? ""} onValueChange={(v) => actualizar("familia", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {opciones.familias.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Subfamilia</Label>
          <Select value={form.subfamilia ?? ""} onValueChange={(v) => actualizar("subfamilia", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {opciones.subfamilias.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Estado de atención</Label>
          <Select
            value={form.estadoAtencion ?? ""}
            onValueChange={(v) => actualizar("estadoAtencion", v as EstadoAtencionLinea)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ESTADO_ATENCION_LABEL) as EstadoAtencionLinea[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {ESTADO_ATENCION_LABEL[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="creacionDesde">Creación desde</Label>
          <Input
            id="creacionDesde"
            type="date"
            value={form.creacionDesde ?? ""}
            onChange={(e) => actualizar("creacionDesde", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="creacionHasta">Creación hasta</Label>
          <Input
            id="creacionHasta"
            type="date"
            value={form.creacionHasta ?? ""}
            onChange={(e) => actualizar("creacionHasta", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="aprobacionDesde">Aprobación desde</Label>
          <Input
            id="aprobacionDesde"
            type="date"
            value={form.aprobacionDesde ?? ""}
            onChange={(e) => actualizar("aprobacionDesde", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="aprobacionHasta">Aprobación hasta</Label>
          <Input
            id="aprobacionHasta"
            type="date"
            value={form.aprobacionHasta ?? ""}
            onChange={(e) => actualizar("aprobacionHasta", e.target.value)}
          />
        </div>
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
        <Button type="button" variant="outline" className="ml-auto" asChild>
          <a href={`/api/excel/reportes-trazabilidad?${new URLSearchParams(valores as Record<string, string>).toString()}`}>
            <Download className="mr-2 h-4 w-4" />
            Exportar a Excel
          </a>
        </Button>
      </div>
    </div>
  );
}
