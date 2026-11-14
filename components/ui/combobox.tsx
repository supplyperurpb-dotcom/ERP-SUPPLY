"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// Clases completas (no interpoladas) para que Tailwind las detecte en el
// escaneo estático — ver DESIGN_SYSTEM.md.
const ANCHO_CLASES = {
  420: "w-[min(90vw,420px)]",
  480: "w-[min(90vw,480px)]",
} as const;

/** Coincidencia por substring, igual en los ~7 comboboxes que existían antes de este primitivo (no el scoring difuso de cmdk). */
function filtroPorCoincidencia(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
}

export type ComboboxOpcionExtra = {
  label: React.ReactNode;
  /** Valor contra el que se compara `value` del combobox (ej. "" para "Sin proveedor"). */
  value: string;
  /** Texto buscable en cmdk; por defecto usa el label si es string. */
  searchValue?: string;
  onSelect: () => void;
};

/**
 * Primitivo compartido por los selectores con búsqueda (Popover + Command)
 * de la app. Cada combobox de dominio (SkuCombobox, VehiculoCombobox, etc.)
 * es un envoltorio fino sobre este componente con su propio tipo de opción
 * — ver DESIGN_SYSTEM.md.
 */
export function Combobox<T>({
  items,
  value,
  onSelect,
  itemKey,
  matchValue,
  searchValue,
  renderItem,
  renderSeleccionado,
  placeholder = "Selecciona...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontró ningún resultado.",
  disabled = false,
  ancho = 480,
  multilinea = false,
  extraOption,
}: {
  items: T[];
  value: string;
  onSelect: (item: T) => void;
  itemKey: (item: T) => string;
  /** Campo contra el que se compara `value` (puede no ser `itemKey`, ej. placa en vez de id). */
  matchValue: (item: T) => string;
  /** Texto buscable en cmdk (ej. "código descripción"). */
  searchValue: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Label del botón cuando hay selección; por defecto usa `renderItem`. */
  renderSeleccionado?: (item: T) => React.ReactNode;
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  emptyMessage?: React.ReactNode;
  disabled?: boolean;
  ancho?: 420 | 480;
  /** Filas multilínea (ver SkuCombobox: código + descripción larga). */
  multilinea?: boolean;
  /** Opción fija antes de la lista (ej. "Sin proveedor"). */
  extraOption?: ComboboxOpcionExtra;
}) {
  const [open, setOpen] = useState(false);
  const seleccionado = items.find((item) => matchValue(item) === value);
  const mostrarExtra = !seleccionado && extraOption && value === extraOption.value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {seleccionado
              ? (renderSeleccionado ?? renderItem)(seleccionado)
              : mostrarExtra
                ? extraOption.label
                : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(ANCHO_CLASES[ancho], "p-0")} align="start">
        <Command filter={filtroPorCoincidencia}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {extraOption && (
                <CommandItem
                  value={extraOption.searchValue ?? (typeof extraOption.label === "string" ? extraOption.label : extraOption.value)}
                  onSelect={() => {
                    extraOption.onSelect();
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === extraOption.value ? "opacity-100" : "opacity-0")} />
                  {extraOption.label}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={itemKey(item)}
                  value={searchValue(item)}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className={multilinea ? "items-start whitespace-normal" : undefined}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      multilinea && "mt-0.5",
                      matchValue(item) === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {renderItem(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
