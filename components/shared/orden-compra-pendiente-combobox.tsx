"use client";

import { Combobox } from "@/components/ui/combobox";

export type OrdenCompraPendienteOpcion = { id: string; numero: string; proveedorRazonSocial: string };

/** Buscador de OC (solo las que tienen algún ítem pendiente de ingresar), por número o proveedor. */
export function OrdenCompraPendienteCombobox({
  ordenes,
  value,
  onSelect,
  disabled = false,
}: {
  ordenes: OrdenCompraPendienteOpcion[];
  value: string;
  onSelect: (orden: OrdenCompraPendienteOpcion) => void;
  disabled?: boolean;
}) {
  return (
    <Combobox
      items={ordenes}
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      placeholder="Busca una orden de compra..."
      searchPlaceholder="Buscar por número de OC o proveedor..."
      emptyMessage="No se encontró ninguna orden de compra con ítems pendientes de ingresar."
      itemKey={(o) => o.id}
      matchValue={(o) => o.id}
      searchValue={(o) => `${o.numero} ${o.proveedorRazonSocial}`}
      renderSeleccionado={(o) => `${o.numero} — ${o.proveedorRazonSocial}`}
      renderItem={(o) => (
        <span className="truncate">
          <span className="font-medium">{o.numero}</span> — {o.proveedorRazonSocial}
        </span>
      )}
    />
  );
}
