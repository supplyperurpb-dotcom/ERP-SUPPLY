"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  const [open, setOpen] = useState(false);
  const seleccionado = skus.find((s) => s.id === value);

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
          <span className="truncate">{seleccionado ? seleccionado.descripcion : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,480px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por código o nombre..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {skus.map((sku) => (
                <CommandItem
                  key={sku.id}
                  value={`${sku.codigo} ${sku.descripcion}`}
                  onSelect={() => {
                    onSelect(sku);
                    setOpen(false);
                  }}
                  className="items-start whitespace-normal"
                >
                  <Check className={cn("mr-2 mt-0.5 h-4 w-4 shrink-0", sku.id === value ? "opacity-100" : "opacity-0")} />
                  <span>
                    <span className="font-medium">{sku.codigo}</span> — {sku.descripcion}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
