"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import {
  agregarSustentoRegistroAvanceAction,
  eliminarSustentoRegistroAvanceAction,
  subirArchivoSustentoAction,
} from "@/lib/actions/servicio-gestionado-actions";

export type SustentoGuardado = { id: string; numero: number; descripcion: string; nombreArchivo: string };

// "Sustento" (PDF/Word/Excel/foto) del registro — "Añadir sustento" crea
// un slot local sin guardar todavía ("Sustento Nro N", correlativo); se
// persiste recién al subir su archivo (descripción + archivo juntos, ver
// agregarSustentoRegistroAvanceAction). Al eliminar uno, los siguientes
// se renumeran en el servidor (ver eliminarSustentoRegistroAvanceAction).
export function SustentosSection({
  registroAvanceId,
  sustentos,
  soloLectura,
}: {
  registroAvanceId: string;
  sustentos: SustentoGuardado[];
  soloLectura: boolean;
}) {
  const [borradores, setBorradores] = useState<{ clave: string; descripcion: string }[]>([]);
  const router = useRouter();

  function agregarBorrador() {
    setBorradores((actual) => [...actual, { clave: crypto.randomUUID(), descripcion: "" }]);
  }

  function quitarBorrador(clave: string) {
    setBorradores((actual) => actual.filter((b) => b.clave !== clave));
  }

  function actualizarDescripcion(clave: string, descripcion: string) {
    setBorradores((actual) => actual.map((b) => (b.clave === clave ? { ...b, descripcion } : b)));
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sustento</h2>
        {!soloLectura && (
          <Button type="button" variant="outline" size="sm" onClick={agregarBorrador}>
            <Plus className="mr-2 h-4 w-4" />
            Añadir sustento
          </Button>
        )}
      </div>

      {sustentos.length === 0 && borradores.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin sustentos añadidos.</p>
      )}

      <div className="space-y-2">
        {sustentos.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <div>
              <p className="font-medium">Sustento Nro {s.numero}</p>
              <p className="text-muted-foreground">{s.descripcion}</p>
              <a
                href={`/api/gestion-servicios/sustento/${s.id}/archivo`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {s.nombreArchivo}
              </a>
            </div>
            {!soloLectura && <EliminarSustentoBoton sustentoId={s.id} />}
          </div>
        ))}
        {borradores.map((b, i) => (
          <SustentoBorrador
            key={b.clave}
            numero={sustentos.length + i + 1}
            registroAvanceId={registroAvanceId}
            descripcion={b.descripcion}
            onDescripcionChange={(d) => actualizarDescripcion(b.clave, d)}
            onGuardado={() => {
              quitarBorrador(b.clave);
              router.refresh();
            }}
            onCancelar={() => quitarBorrador(b.clave)}
          />
        ))}
      </div>
    </div>
  );
}

function SustentoBorrador({
  numero,
  registroAvanceId,
  descripcion,
  onDescripcionChange,
  onGuardado,
  onCancelar,
}: {
  numero: number;
  registroAvanceId: string;
  descripcion: string;
  onDescripcionChange: (valor: string) => void;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubir() {
    if (!descripcion.trim()) {
      toast.error("Escribe una descripción del sustento.");
      return;
    }
    if (!archivo) {
      toast.error("Selecciona un archivo.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const subida = await subirArchivoSustentoAction(formData);
      if (subida.error || !subida.path || !subida.nombreArchivo) {
        toast.error(subida.error ?? "No se pudo subir el archivo");
        return;
      }
      const resultado = await agregarSustentoRegistroAvanceAction(registroAvanceId, descripcion, subida.path, subida.nombreArchivo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Sustento añadido");
      onGuardado();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Sustento Nro {numero}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <Input placeholder="Descripción" value={descripcion} onChange={(e) => onDescripcionChange(e.target.value)} />
        <Input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="sm:w-56"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={handleSubir}>
            Subir archivo
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function EliminarSustentoBoton({ sustentoId }: { sustentoId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleClick() {
    if (!(await confirmar("¿Eliminar este sustento?"))) return;
    startTransition(async () => {
      const resultado = await eliminarSustentoRegistroAvanceAction(sustentoId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Sustento eliminado");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={handleClick}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
