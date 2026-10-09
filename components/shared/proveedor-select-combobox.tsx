"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type ProveedorOpcionSelect = { id: string; razonSocial: string; ruc?: string; condicionPago?: string };

const SIN_PROVEEDOR = "__sin_proveedor__";

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
  const [open, setOpen] = useState(false);
  const seleccionado = proveedores.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">{seleccionado ? seleccionado.razonSocial : "Sin proveedor"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,480px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No se encontró ningún proveedor.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={SIN_PROVEEDOR}
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === "" ? "opacity-100" : "opacity-0")} />
                Sin proveedor
              </CommandItem>
              {proveedores.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.razonSocial}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", p.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{p.razonSocial}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
