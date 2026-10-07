"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
}: {
  retiradores: RetiradorOpcionCombobox[];
  value: string;
  onSelect: (retirador: RetiradorOpcionCombobox) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const seleccionado = retiradores.find((r) => r.id === value);

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
            {seleccionado ? `${seleccionado.nombreCompleto} — DNI ${seleccionado.dni}` : "Busca por nombre o DNI..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,480px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por nombre o DNI..." />
          <CommandList>
            <CommandEmpty>
              {disabled
                ? "Selecciona primero el almacén."
                : "Nadie tiene permiso de retirar de este almacén. Agrégalo en Listas > Retiradores autorizados."}
            </CommandEmpty>
            <CommandGroup>
              {retiradores.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.nombreCompleto} ${r.dni}`}
                  onSelect={() => {
                    onSelect(r);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", r.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {r.nombreCompleto} — DNI {r.dni}
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
