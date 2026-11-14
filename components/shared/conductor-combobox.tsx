"use client";

import { Combobox } from "@/components/ui/combobox";

export type ConductorOpcionCombobox = { id: string; nombre: string };

/** Selector de conductor con filtro por nombre — reemplaza el <Select>
 * nativo en Despacho/Ingreso de Acopio, que obligaba a desplazarse por
 * toda la lista para encontrar un nombre. */
export function ConductorCombobox({
  conductores,
  value,
  onSelect,
}: {
  conductores: ConductorOpcionCombobox[];
  value: string;
  onSelect: (conductor: ConductorOpcionCombobox) => void;
}) {
  return (
    <Combobox
      items={conductores}
      value={value}
      onSelect={onSelect}
      ancho={420}
      placeholder="Busca por nombre..."
      searchPlaceholder="Buscar por nombre..."
      emptyMessage="Ningún conductor coincide. Créalo en Información Transporte."
      itemKey={(c) => c.id}
      matchValue={(c) => c.nombre}
      searchValue={(c) => c.nombre}
      renderSeleccionado={(c) => c.nombre}
      renderItem={(c) => <span className="truncate">{c.nombre}</span>}
    />
  );
}
