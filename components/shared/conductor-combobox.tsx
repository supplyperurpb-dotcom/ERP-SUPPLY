"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  const [open, setOpen] = useState(false);
  const seleccionado = conductores.find((c) => c.nombre === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between font-normal">
          <span className="truncate">{seleccionado ? seleccionado.nombre : "Busca por nombre..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,420px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por nombre..." />
          <CommandList>
            <CommandEmpty>Ningún conductor coincide. Créalo en Información Transporte.</CommandEmpty>
            <CommandGroup>
              {conductores.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.nombre}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", c.nombre === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.nombre}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
