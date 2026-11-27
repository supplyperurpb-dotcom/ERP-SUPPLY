"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subirArchivoSustentoOrdenAction } from "@/lib/actions/orden-compra-actions";

export type SustentoOrden = { archivo: string; nombreArchivo: string };

type Slot = { clave: string; archivo: string; nombreArchivo: string; subiendo: boolean };

// Campo de sustento de una OC/OS en creación: empieza con un solo
// selector (como antes), y "Añadir sustento" agrega otro — igual que
// Sustentos de Registro de Avance (ver sustentos-section.tsx en
// gestion-servicios), salvo que acá la orden todavía no existe, así que
// cada archivo solo se sube al bucket (subirArchivoSustentoOrdenAction) y
// se junta en memoria; recién se guarda como fila al crear la orden (ver
// crearOrdenCompraAction/crearOrdenCompraDirectaAction).
export function SustentosOrdenField({
  value,
  onChange,
}: {
  value: SustentoOrden[];
  onChange: (value: SustentoOrden[]) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([{ clave: crypto.randomUUID(), archivo: "", nombreArchivo: "", subiendo: false }]);

  function emitir(nuevosSlots: Slot[]) {
    setSlots(nuevosSlots);
    onChange(nuevosSlots.filter((s) => s.archivo).map((s) => ({ archivo: s.archivo, nombreArchivo: s.nombreArchivo })));
  }

  function agregarSlot() {
    emitir([...slots, { clave: crypto.randomUUID(), archivo: "", nombreArchivo: "", subiendo: false }]);
  }

  function quitarSlot(clave: string) {
    const restantes = slots.filter((s) => s.clave !== clave);
    emitir(restantes.length > 0 ? restantes : [{ clave: crypto.randomUUID(), archivo: "", nombreArchivo: "", subiendo: false }]);
  }

  async function handleArchivo(clave: string, archivo: File | undefined) {
    if (!archivo) return;
    emitir(slots.map((s) => (s.clave === clave ? { ...s, archivo: "", nombreArchivo: "", subiendo: true } : s)));
    const formData = new FormData();
    formData.set("archivo", archivo);
    const resultado = await subirArchivoSustentoOrdenAction(formData);
    if (resultado.error || !resultado.path || !resultado.nombreArchivo) {
      toast.error(resultado.error ?? "No se pudo subir el archivo");
      emitir(slots.map((s) => (s.clave === clave ? { ...s, subiendo: false } : s)));
      return;
    }
    emitir(
      slots.map((s) => (s.clave === clave ? { ...s, archivo: resultado.path!, nombreArchivo: resultado.nombreArchivo!, subiendo: false } : s))
    );
  }

  const haySubiendo = slots.some((s) => s.subiendo);

  return (
    <div className="space-y-2 sm:col-span-3">
      <div className="flex items-center justify-between">
        <Label>Sustento (obligatorio)</Label>
        <Button type="button" variant="outline" size="sm" onClick={agregarSlot} disabled={haySubiendo}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir sustento
        </Button>
      </div>
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <SlotSustento
            key={slot.clave}
            numero={i + 1}
            slot={slot}
            puedeQuitar={slots.length > 1}
            onArchivo={(archivo) => handleArchivo(slot.clave, archivo)}
            onQuitar={() => quitarSlot(slot.clave)}
          />
        ))}
      </div>
      {value.length === 0 && <p className="text-xs text-muted-foreground">PDF, Word, Excel o una imagen, hasta 15 MB.</p>}
    </div>
  );
}

function SlotSustento({
  numero,
  slot,
  puedeQuitar,
  onArchivo,
  onQuitar,
}: {
  numero: number;
  slot: Slot;
  puedeQuitar: boolean;
  onArchivo: (archivo: File | undefined) => void;
  onQuitar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 space-y-1">
        <Input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
          disabled={slot.subiendo}
          onChange={(e) => onArchivo(e.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">
          {slot.subiendo ? "Subiendo..." : slot.nombreArchivo ? `Adjunto: ${slot.nombreArchivo}` : `Sustento ${numero}`}
        </p>
      </div>
      {puedeQuitar && (
        <Button type="button" variant="ghost" size="icon" onClick={onQuitar} disabled={slot.subiendo} title="Quitar">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
