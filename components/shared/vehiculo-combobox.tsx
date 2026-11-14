"use client";

import { Combobox } from "@/components/ui/combobox";

export type VehiculoOpcionCombobox = { id: string; placa: string; tipo: string; codigoEquipo?: string | null };

/** Selector con filtro por placa, usado al registrar un Consumo de un almacén de Combustible. */
export function VehiculoCombobox({
  vehiculos,
  value,
  onSelect,
}: {
  vehiculos: VehiculoOpcionCombobox[];
  value: string;
  onSelect: (vehiculo: VehiculoOpcionCombobox) => void;
}) {
  return (
    <Combobox
      items={vehiculos}
      value={value}
      onSelect={onSelect}
      ancho={420}
      placeholder="Busca por placa..."
      searchPlaceholder="Buscar por placa..."
      emptyMessage="Ningún vehículo coincide. Agrégalo en Listas &gt; Vehículos."
      itemKey={(v) => v.id}
      matchValue={(v) => v.placa}
      searchValue={(v) => `${v.placa} ${v.codigoEquipo ?? ""}`}
      renderSeleccionado={(v) => (
        <>
          <span className="font-mono">{v.placa}</span> — {v.tipo}
        </>
      )}
      renderItem={(v) => (
        <span className="truncate">
          <span className="font-mono">{v.placa}</span> — {v.tipo}
          {v.codigoEquipo ? ` (${v.codigoEquipo})` : ""}
        </span>
      )}
    />
  );
}
