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

// Un solo calendario donde seleccionar primero el día "desde" y después el
// "hasta" arma el rango (react-day-picker mode="range" ya hace exactamente
// eso) — mismo formato en todos los filtros de fecha del sistema (pedido
// explícito), reemplazando los 2 <input type="date"> sueltos de antes.
//
// Dos formas de usarlo:
// - Dentro de un <form> GET normal (la mayoría de los filtros de este
//   sistema): los valores viajan solos en los inputs ocultos "desde"/"hasta"
//   (o los nombres que se pasen en nombreDesde/nombreHasta), sin necesidad
//   de leer `onChange`.
// - Filtros armados en el cliente (ej. que arman el query string ellos
//   mismos con router.push en vez de un submit nativo): pasar `onChange`
//   además, para enterarse del cambio al tiro.
export function FiltroRangoFecha({
  desde,
  hasta,
  label = "Fecha",
  nombreDesde = "desde",
  nombreHasta = "hasta",
  onChange,
  className,
}: {
  desde: string;
  hasta: string;
  label?: string;
  nombreDesde?: string;
  nombreHasta?: string;
  onChange?: (valores: { desde: string; hasta: string }) => void;
  className?: string;
}) {
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
    if (onChange) {
      const d = nuevoRango?.from ? format(nuevoRango.from, "yyyy-MM-dd") : "";
      const h = nuevoRango?.to ? format(nuevoRango.to, "yyyy-MM-dd") : d;
      onChange({ desde: d, hasta: h });
    }
  }

  const valorDesde = range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const valorHasta = range?.to ? format(range.to, "yyyy-MM-dd") : valorDesde;

  const textoBoton = range?.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${format(range.from, "dd/MM/yyyy")} – ${format(range.to, "dd/MM/yyyy")}`
      : format(range.from, "dd/MM/yyyy")
    : "Selecciona una fecha";

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label>{label}</Label>
      <input type="hidden" name={nombreDesde} value={valorDesde} />
      <input type="hidden" name={nombreHasta} value={valorHasta} />
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
