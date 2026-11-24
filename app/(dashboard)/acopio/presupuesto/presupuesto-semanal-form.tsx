"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  guardarPresupuestoSemanalAction,
  type PresupuestoCosechaActionState,
} from "@/lib/actions/presupuesto-cosecha-actions";

type Fila = { semana: number; variedad: string; kgBudget: number | null; kgOct: number | null };

export function PresupuestoSemanalForm({ anio, filas }: { anio: number; filas: Fila[] }) {
  const [state, formAction] = useFormState<PresupuestoCosechaActionState, FormData>(guardarPresupuestoSemanalAction, undefined);

  useEffect(() => {
    if (state?.success) toast.success("Presupuesto semanal guardado");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="anio" value={anio} />
      <div className="mb-3">
        <SubmitButton />
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Variedad</TableHead>
              <TableHead numeric>KG Budget</TableHead>
              <TableHead numeric>KG Oct</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={`${f.semana}__${f.variedad}`}>
                <TableCell>W{f.semana}</TableCell>
                <TableCell className="font-medium">{f.variedad}</TableCell>
                <TableCell numeric>
                  <Input
                    type="number"
                    step="0.01"
                    name={`kgBudget__${f.semana}__${f.variedad}`}
                    defaultValue={f.kgBudget ?? ""}
                    className="ml-auto w-[130px] text-right"
                  />
                </TableCell>
                <TableCell numeric>
                  <Input
                    type="number"
                    step="0.01"
                    name={`kgOct__${f.semana}__${f.variedad}`}
                    defaultValue={f.kgOct ?? ""}
                    className="ml-auto w-[130px] text-right"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : "Guardar presupuesto semanal"}
    </Button>
  );
}
