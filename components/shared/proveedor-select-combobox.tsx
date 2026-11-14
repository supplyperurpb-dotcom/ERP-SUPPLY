"use client";

import { Combobox } from "@/components/ui/combobox";

export type ProveedorOpcionSelect = { id: string; razonSocial: string; ruc?: string; condicionPago?: string };

/**
 * Selector de proveedor (para un campo real proveedorId, no texto libre)
 * con filtro por coincidencia mientras escribes, igual que el buscador de
 * SKU. Incluye siempre la opción "Sin proveedor" para poder dejarlo vacío.
 */
export function ProveedorSelectCombobox({
  proveedores,
  value,
  onSelect,
  placeholder = "Selecciona un proveedor",
}: {
  proveedores: ProveedorOpcionSelect[];
  /** vacío ("") representa "sin proveedor" */
  value: string;
  onSelect: (proveedor: ProveedorOpcionSelect | null) => void;
  placeholder?: string;
}) {
  return (
    <Combobox
      items={proveedores}
      value={value}
      onSelect={onSelect}
      placeholder="Sin proveedor"
      searchPlaceholder={placeholder}
      emptyMessage="No se encontró ningún proveedor."
      itemKey={(p) => p.id}
      matchValue={(p) => p.id}
      searchValue={(p) => `${p.razonSocial} ${p.ruc ?? ""}`}
      renderSeleccionado={(p) => p.razonSocial}
      renderItem={(p) => (
        <span className="truncate">
          {p.ruc ? <span className="text-muted-foreground">RUC {p.ruc} — </span> : null}
          {p.razonSocial}
        </span>
      )}
      extraOption={{
        label: "Sin proveedor",
        value: "",
        searchValue: "Sin proveedor",
        onSelect: () => onSelect(null),
      }}
    />
  );
}
