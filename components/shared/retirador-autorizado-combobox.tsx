"use client";

import { Combobox } from "@/components/ui/combobox";

export type RetiradorOpcionCombobox = { id: string; nombreCompleto: string; dni: string };

/**
 * Selector con filtro por nombre o DNI, ya restringido por el llamador a
 * los retiradores autorizados a retirar del almacén elegido (ver
 * consumo-almacen-form.tsx) — si alguien no tiene permiso en ese almacén,
 * simplemente no aparece en `retiradores`.
 */
export function RetiradorAutorizadoCombobox({
  retiradores,
  value,
  onSelect,
  disabled = false,
  mensajeDeshabilitado = "Selecciona primero el almacén.",
  mensajeVacio = "Nadie tiene permiso de retirar de este almacén. Agrégalo en Listas > Retiradores autorizados.",
}: {
  retiradores: RetiradorOpcionCombobox[];
  value: string;
  onSelect: (retirador: RetiradorOpcionCombobox) => void;
  disabled?: boolean;
  mensajeDeshabilitado?: string;
  mensajeVacio?: string;
}) {
  return (
    <Combobox
      items={retiradores}
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      placeholder="Busca por nombre o DNI..."
      searchPlaceholder="Buscar por nombre o DNI..."
      emptyMessage={disabled ? mensajeDeshabilitado : mensajeVacio}
      itemKey={(r) => r.id}
      matchValue={(r) => r.id}
      searchValue={(r) => `${r.nombreCompleto} ${r.dni}`}
      renderSeleccionado={(r) => (
        <>
          {r.nombreCompleto} — DNI <span className="font-mono">{r.dni}</span>
        </>
      )}
      renderItem={(r) => (
        <span className="truncate">
          {r.nombreCompleto} — DNI <span className="font-mono">{r.dni}</span>
        </span>
      )}
    />
  );
}
