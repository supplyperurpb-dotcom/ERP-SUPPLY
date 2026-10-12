"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type VehiculoOpcionCombobox = { id: string; placa: string; tipo: string };

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
  const [open, setOpen] = useState(false);
  const seleccionado = vehiculos.find((v) => v.placa === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between font-normal">
          <span className="truncate">{seleccionado ? `${seleccionado.placa} — ${seleccionado.tipo}` : "Busca por placa..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,420px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por placa..." />
          <CommandList>
            <CommandEmpty>Ningún vehículo coincide. Agrégalo en Listas &gt; Vehículos.</CommandEmpty>
            <CommandGroup>
              {vehiculos.map((v) => (
                <CommandItem
                  key={v.id}
                  value={v.placa}
                  onSelect={() => {
                    onSelect(v);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", v.placa === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {v.placa} — {v.tipo}
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
