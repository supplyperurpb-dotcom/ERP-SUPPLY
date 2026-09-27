"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export type ProveedorOpcionRemitente = { id: string; razonSocial: string; ruc: string };

/**
 * Campo de texto libre para "remitente" que, mientras escribes, sugiere
 * proveedores ya registrados que coincidan (búsqueda por texto contenido,
 * no solo por inicio). Al elegir uno, también completa su RUC. Sigue siendo
 * texto libre: si el remitente no está en el catálogo, se puede escribir
 * cualquier nombre sin que se bloquee el formulario.
 */
export function ProveedorRemitenteCombobox({
  proveedores,
  value,
  onChange,
  onSelect,
  placeholder = "Nombre del remitente",
}: {
  proveedores: ProveedorOpcionRemitente[];
  value: string;
  onChange: (texto: string) => void;
  onSelect: (proveedor: ProveedorOpcionRemitente) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const coincidencias =
    value.trim() === ""
      ? proveedores.slice(0, 20)
      : proveedores.filter((p) => p.razonSocial.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 20);

  return (
    <Popover open={open && coincidencias.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandGroup heading="Proveedores">
              {coincidencias.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">
                    {p.razonSocial}
                    {p.ruc && <span className="text-muted-foreground"> — RUC {p.ruc}</span>}
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
