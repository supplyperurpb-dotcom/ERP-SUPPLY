"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type OrdenCompraPendienteOpcion = { id: string; numero: string; proveedorRazonSocial: string };

/** Buscador de OC (solo las que tienen algún ítem pendiente de ingresar), por número o proveedor. */
export function OrdenCompraPendienteCombobox({
  ordenes,
  value,
  onSelect,
  disabled = false,
}: {
  ordenes: OrdenCompraPendienteOpcion[];
  value: string;
  onSelect: (orden: OrdenCompraPendienteOpcion) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const seleccionada = ordenes.find((o) => o.id === value);

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
            {seleccionada ? `${seleccionada.numero} — ${seleccionada.proveedorRazonSocial}` : "Busca una orden de compra..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,480px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por número de OC o proveedor..." />
          <CommandList>
            <CommandEmpty>No se encontró ninguna orden de compra con ítems pendientes de ingresar.</CommandEmpty>
            <CommandGroup>
              {ordenes.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.numero} ${o.proveedorRazonSocial}`}
                  onSelect={() => {
                    onSelect(o);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", o.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    <span className="font-medium">{o.numero}</span> — {o.proveedorRazonSocial}
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
