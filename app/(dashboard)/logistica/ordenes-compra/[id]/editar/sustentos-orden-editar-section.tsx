"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import {
  agregarSustentoOrdenCompraAction,
  eliminarSustentoOrdenCompraAction,
  eliminarSustentoLegadoOrdenCompraAction,
  subirArchivoSustentoOrdenAction,
} from "@/lib/actions/orden-compra-actions";

export type SustentoOrdenGuardado = { id: string; numero: number; nombreArchivo: string };

// Sustento(s) de una OC/OS ya creada: a diferencia de SustentosOrdenField
// (usado al crear, donde la orden todavía no existe), acá cada archivo se
// sube y se guarda de inmediato (igual que Sustentos de Registro de
// Avance) — así se puede corregir un archivo equivocado sin recrear la
// orden entera (pedido explícito, 2026-11-27).
export function SustentosOrdenEditarSection({
  ordenCompraId,
  sustentos,
  legado,
}: {
  ordenCompraId: string;
  sustentos: SustentoOrdenGuardado[];
  /** Archivo único de antes de admitir varios (OrdenCompra.archivo/nombreArchivo) — solo si todavía no se agregó ningún sustento nuevo. */
  legado: { nombreArchivo: string } | null;
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleArchivo(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const subida = await subirArchivoSustentoOrdenAction(formData);
      if (subida.error || !subida.path || !subida.nombreArchivo) {
        toast.error(subida.error ?? "No se pudo subir el archivo");
        return;
      }
      const resultado = await agregarSustentoOrdenCompraAction(ordenCompraId, subida.path, subida.nombreArchivo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Sustento añadido");
      router.refresh();
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 sm:col-span-3">
      <div className="flex items-center justify-between">
        <Label>Sustento{sustentos.length > 1 ? "s" : ""} (obligatorio)</Label>
      </div>

      {sustentos.length === 0 && !legado && <p className="text-sm text-muted-foreground">Sin sustentos añadidos.</p>}

      <div className="space-y-2">
        {legado && <SustentoLegadoFila ordenCompraId={ordenCompraId} nombreArchivo={legado.nombreArchivo} />}
        {sustentos.map((s) => (
          <SustentoFila key={s.id} sustento={s} />
        ))}
      </div>

      <div className="space-y-1">
        <Input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" disabled={subiendo} onChange={(e) => handleArchivo(e.target.files?.[0])} />
        <p className="text-xs text-muted-foreground">
          {subiendo ? "Subiendo..." : "Añadir sustento: elige un archivo (PDF, Word, Excel o imagen, hasta 15 MB)."}
        </p>
      </div>
    </div>
  );
}

function SustentoFila({ sustento }: { sustento: SustentoOrdenGuardado }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleEliminar() {
    if (!(await confirmar(`¿Eliminar el sustento "${sustento.nombreArchivo}"?`))) return;
    startTransition(async () => {
      const resultado = await eliminarSustentoOrdenCompraAction(sustento.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Sustento eliminado");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <a
        href={`/api/logistica/ordenes-compra/sustento/${sustento.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
        {sustento.numero}. {sustento.nombreArchivo}
      </a>
      <Button variant="ghost" size="icon" disabled={pending} onClick={handleEliminar}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function SustentoLegadoFila({ ordenCompraId, nombreArchivo }: { ordenCompraId: string; nombreArchivo: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  async function handleEliminar() {
    if (!(await confirmar(`¿Eliminar el sustento "${nombreArchivo}"?`))) return;
    startTransition(async () => {
      const resultado = await eliminarSustentoLegadoOrdenCompraAction(ordenCompraId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Sustento eliminado");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <a
        href={`/api/logistica/ordenes-compra/${ordenCompraId}/sustento`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
        {nombreArchivo}
      </a>
      <Button variant="ghost" size="icon" disabled={pending} onClick={handleEliminar}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
