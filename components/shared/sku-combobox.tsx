"use client";

import { Combobox } from "@/components/ui/combobox";

export type SkuOpcionCombobox = { id: string; codigo: string; descripcion: string; unidadMedida: string };

/**
 * Selector de SKU con filtro por texto (código o descripción), en vez del
 * <Select> nativo que obligaba a desplazarse por toda la lista para
 * encontrar un producto por su nombre.
 */
export function SkuCombobox({
  skus,
  value,
  onSelect,
  placeholder = "Selecciona...",
  disabled = false,
  emptyMessage = "No se encontró ningún producto.",
}: {
  skus: SkuOpcionCombobox[];
  value: string;
  onSelect: (sku: SkuOpcionCombobox) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  return (
    <Combobox
      items={skus}
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder="Buscar por código o nombre..."
      emptyMessage={emptyMessage}
      multilinea
      itemKey={(sku) => sku.id}
      matchValue={(sku) => sku.id}
      searchValue={(sku) => `${sku.codigo} ${sku.descripcion}`}
      renderSeleccionado={(sku) => sku.descripcion}
      renderItem={(sku) => (
        <span>
          <span className="font-mono font-medium">{sku.codigo}</span> — {sku.descripcion}
        </span>
      )}
    />
  );
}
