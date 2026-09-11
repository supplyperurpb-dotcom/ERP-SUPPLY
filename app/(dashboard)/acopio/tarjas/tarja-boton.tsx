"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { crearTarjaAction } from "@/lib/actions/tarja-actions";

export function TarjaBoton({ palletId, tarjaNumero }: { palletId: string; tarjaNumero: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (tarjaNumero) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/pdf/tarja/${palletId}`} target="_blank" rel="noopener noreferrer">
          <FileText className="mr-2 h-4 w-4" />
          Ver PDF ({tarjaNumero})
        </a>
      </Button>
    );
  }

  function generar() {
    startTransition(async () => {
      const resultado = await crearTarjaAction(palletId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Tarja generada");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={generar} disabled={isPending}>
      <Tag className="mr-2 h-4 w-4" />
      {isPending ? "Generando..." : "Generar tarja"}
    </Button>
  );
}
