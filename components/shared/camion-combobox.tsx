"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  const [open, setOpen] = useState(false);
  const seleccionado = camiones.find((c) => c.placa === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between font-normal">
          <span className="truncate">
            {seleccionado ? `${seleccionado.placa} — ${TIPO_CAMION_LABEL[seleccionado.tipo] ?? seleccionado.tipo}` : "Busca por placa..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(90vw,420px)] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por placa..." />
          <CommandList>
            <CommandEmpty>Ningún camión coincide. Créalo en Información Transporte.</CommandEmpty>
            <CommandGroup>
              {camiones.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.placa}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", c.placa === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {c.placa} — {TIPO_CAMION_LABEL[c.tipo] ?? c.tipo}
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
