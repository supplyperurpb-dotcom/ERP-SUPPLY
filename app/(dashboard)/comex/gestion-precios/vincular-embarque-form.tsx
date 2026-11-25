"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Link2Off } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { buscarEmbarquePorIdentificadorAction, vincularEmbarqueFacturacionAction } from "@/lib/actions/gestion-precios-actions";

type EmbarqueVinculado = { id: string; numero: string; shipNumber: string | null } | null;

// Vínculo Facturación -> Embarque (Etapa E del plan): se guarda por PO en
// TODAS las líneas de HistoricalBilling de ese PO. El automático (hecho
// al migrar) y el manual (acá) son el mismo campo — este formulario solo
// deja corregirlo o completarlo cuando no hubo match.
export function VincularEmbarqueForm({
  po,
  embarqueVinculado,
  embarqueVinculadoPor,
}: {
  po: string;
  embarqueVinculado: EmbarqueVinculado;
  embarqueVinculadoPor: "AUTOMATICO" | "MANUAL" | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [guardando, startGuardado] = useTransition();

  function buscarYVincular() {
    if (!valor.trim()) {
      toast.error("Escribe el Ship Number o el N° interno del embarque.");
      return;
    }
    startGuardado(async () => {
      const embarque = await buscarEmbarquePorIdentificadorAction(valor.trim());
      if (!embarque) {
        toast.error("No se encontró ningún embarque con ese Ship Number o N° interno.");
        return;
      }
      const resultado = await vincularEmbarqueFacturacionAction(po, embarque.id);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Embarque vinculado");
      router.refresh();
    });
  }

  function desvincular() {
    startGuardado(async () => {
      const resultado = await vincularEmbarqueFacturacionAction(po, null);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Embarque desvinculado");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        {embarqueVinculado ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 text-emerald-600" />
              <span>
                Vinculado a <span className="font-medium">{embarqueVinculado.numero}</span>
                {embarqueVinculado.shipNumber ? ` (${embarqueVinculado.shipNumber})` : ""}
              </span>
              <Badge variant="secondary">{embarqueVinculadoPor === "MANUAL" ? "Manual" : "Automático"}</Badge>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={desvincular} disabled={guardando}>
              <Link2Off className="mr-2 h-4 w-4" />
              Desvincular
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2Off className="h-4 w-4" />
              Sin embarque vinculado
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="w-56"
                placeholder="Ship Number o N° interno"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <Button type="button" size="sm" onClick={buscarYVincular} disabled={guardando}>
                Vincular
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
