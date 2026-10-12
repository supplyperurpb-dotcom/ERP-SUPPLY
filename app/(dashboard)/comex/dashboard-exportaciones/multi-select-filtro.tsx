"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";

// Select con casillas: deja marcar varios valores a la vez (ej. 3 semanas,
// 2 mercados). Genérico — solo recibe las opciones y el valor seleccionado,
// no sabe nada del dominio (semana, mercado, destino).
export function MultiSelectFiltro({
  etiqueta,
  opciones,
  seleccionados,
  onChange,
}: {
  etiqueta: string;
  opciones: string[];
  seleccionados: string[];
  onChange: (valores: string[]) => void;
}) {
  function alternar(valor: string) {
    onChange(seleccionados.includes(valor) ? seleccionados.filter((v) => v !== valor) : [...seleccionados, valor]);
  }

  const textoBoton =
    seleccionados.length === 0
      ? `Todas (${etiqueta})`
      : seleccionados.length === 1
        ? seleccionados[0]
        : `${seleccionados.length} seleccionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{textoBoton}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {opciones.map((opcion) => {
                const marcado = seleccionados.includes(opcion);
                return (
                  <CommandItem key={opcion} onSelect={() => alternar(opcion)} className="cursor-pointer gap-2">
                    <Checkbox checked={marcado} onCheckedChange={() => alternar(opcion)} />
                    <span>{opcion}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {seleccionados.length > 0 && (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
                Limpiar selección
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
