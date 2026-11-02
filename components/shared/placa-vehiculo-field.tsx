"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { crearVehiculoTransporteAction } from "@/lib/actions/vehiculo-transporte-actions";

export type VehiculoTransporteOption = { id: string; placa: string; tipo: "PROPIO" | "TERCERO" };

const TIPO_LABEL: Record<"PROPIO" | "TERCERO", string> = { PROPIO: "Propio", TERCERO: "Tercero" };

/**
 * Selector de placa registrada + botón "Registrar vehículo" (placa + si es
 * propio o tercero), usado en los formularios de Ingreso/Despacho de
 * Acopio en vez de un <Input> de texto libre.
 */
export function PlacaVehiculoField({
  vehiculos,
  value,
  onChange,
}: {
  vehiculos: VehiculoTransporteOption[];
  value: string;
  onChange: (placa: string) => void;
}) {
  const [lista, setLista] = useState(vehiculos);
  const [open, setOpen] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [placaNueva, setPlacaNueva] = useState("");
  const [tipoNuevo, setTipoNuevo] = useState<"PROPIO" | "TERCERO">("TERCERO");
  const [guardando, setGuardando] = useState(false);

  const seleccionado = lista.find((v) => v.placa === value);

  async function registrar() {
    if (!placaNueva.trim()) {
      toast.error("Ingresa la placa");
      return;
    }
    setGuardando(true);
    try {
      const resultado = await crearVehiculoTransporteAction({ placa: placaNueva, tipo: tipoNuevo });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      if (resultado?.placa && resultado.tipo) {
        const placa = resultado.placa;
        const tipo = resultado.tipo as "PROPIO" | "TERCERO";
        setLista((prev) => (prev.some((v) => v.placa === placa) ? prev : [{ id: resultado.id!, placa, tipo }, ...prev]));
        onChange(placa);
        toast.success("Vehículo registrado");
        setDialogoAbierto(false);
        setPlacaNueva("");
        setTipoNuevo("TERCERO");
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 flex-1 justify-between font-normal"
          >
            <span className="truncate">
              {seleccionado
                ? `${seleccionado.placa} — ${TIPO_LABEL[seleccionado.tipo]}`
                : value || "Busca por placa..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(90vw,340px)] p-0" align="start">
          <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder="Buscar por placa..." />
            <CommandList>
              <CommandEmpty>Ninguna placa registrada coincide. Regístrala con el botón de al lado.</CommandEmpty>
              <CommandGroup>
                {lista.map((v) => (
                  <CommandItem
                    key={v.id}
                    value={v.placa}
                    onSelect={() => {
                      onChange(v.placa);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", v.placa === value ? "opacity-100" : "opacity-0")} />
                    {v.placa} — {TIPO_LABEL[v.tipo]}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Registrar vehículo
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar vehículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="placaNueva">Placa</Label>
              <Input
                id="placaNueva"
                placeholder="Ej. ABC-123"
                value={placaNueva}
                onChange={(e) => setPlacaNueva(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>¿Es propio o de tercero?</Label>
              <Select value={tipoNuevo} onValueChange={(v) => setTipoNuevo(v as "PROPIO" | "TERCERO")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPIO">Propio</SelectItem>
                  <SelectItem value="TERCERO">Tercero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={registrar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
