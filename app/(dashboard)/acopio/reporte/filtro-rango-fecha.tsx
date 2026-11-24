"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Pedido explícito: un solo calendario donde seleccionar primero el día
// "desde" y después el día "hasta" arma el rango (react-day-picker
// mode="range" ya hace exactamente eso) — reemplaza los 2 <input
// type="date"> sueltos de antes. Los valores siguen viajando como
// "desde"/"hasta" en inputs ocultos dentro del mismo <form> de filtros, así
// que "Aplicar filtros" sigue siendo una navegación GET normal, sin cambiar
// la arquitectura de la página.
export function FiltroRangoFecha({ desde, hasta }: { desde: string; hasta: string }) {
  const [range, setRange] = useState<DateRange | undefined>({
    from: desde ? parseISO(desde) : undefined,
    to: hasta ? parseISO(hasta) : undefined,
  });
  const [open, setOpen] = useState(false);

  function alSeleccionar(nuevoRango: DateRange | undefined) {
    setRange(nuevoRango);
    // Se cierra solo al completar el rango (from + to) — mientras solo hay
    // "from" se deja abierto para elegir el segundo día.
    if (nuevoRango?.from && nuevoRango?.to) setOpen(false);
  }

  const valorDesde = range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const valorHasta = range?.to ? format(range.to, "yyyy-MM-dd") : valorDesde;

  const textoBoton = range?.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${format(range.from, "dd/MM/yyyy")} – ${format(range.to, "dd/MM/yyyy")}`
      : format(range.from, "dd/MM/yyyy")
    : "Selecciona una fecha";

  return (
    <div className="grid gap-1.5">
      <Label>Fecha de cosecha</Label>
      <input type="hidden" name="desde" value={valorDesde} />
      <input type="hidden" name="hasta" value={valorHasta} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-[230px] justify-start text-left font-normal", !range?.from && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {textoBoton}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range" selected={range} onSelect={alSeleccionar} numberOfMonths={1} locale={es} defaultMonth={range?.from} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
