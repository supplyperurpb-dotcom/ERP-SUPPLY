"use client";

import { Combobox } from "@/components/ui/combobox";
import { TIPOS_CAMION } from "@/lib/validations/transporte";

export type CamionOpcionCombobox = { id: string; placa: string; tipo: string };

const TIPO_CAMION_LABEL = Object.fromEntries(TIPOS_CAMION.map((t) => [t.valor, t.nombre])) as Record<string, string>;

/** Selector de camión con filtro por placa — reemplaza el <Select> nativo
 * en Despacho/Ingreso de Acopio, que obligaba a desplazarse por toda la
 * lista para encontrar una placa. */
export function CamionCombobox({
  camiones,
  value,
  onSelect,
}: {
  camiones: CamionOpcionCombobox[];
  value: string;
  onSelect: (camion: CamionOpcionCombobox) => void;
}) {
  return (
    <Combobox
      items={camiones}
      value={value}
      onSelect={onSelect}
      ancho={420}
      placeholder="Busca por placa..."
      searchPlaceholder="Buscar por placa..."
      emptyMessage="Ningún camión coincide. Créalo en Información Transporte."
      itemKey={(c) => c.id}
      matchValue={(c) => c.placa}
      searchValue={(c) => c.placa}
      renderSeleccionado={(c) => `${c.placa} — ${TIPO_CAMION_LABEL[c.tipo] ?? c.tipo}`}
      renderItem={(c) => (
        <span className="truncate">
          {c.placa} — {TIPO_CAMION_LABEL[c.tipo] ?? c.tipo}
        </span>
      )}
    />
  );
}
