"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  guardarPresupuestoVariedadAction,
  type PresupuestoCosechaActionState,
} from "@/lib/actions/presupuesto-cosecha-actions";

export function PresupuestoVariedadForm({
  anio,
  filas,
}: {
  anio: number;
  filas: { variedad: string; hectareas: number | null }[];
}) {
  const [state, formAction] = useFormState<PresupuestoCosechaActionState, FormData>(guardarPresupuestoVariedadAction, undefined);

  useEffect(() => {
    if (state?.success) toast.success("Hectáreas guardadas");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="anio" value={anio} />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variedad</TableHead>
              <TableHead numeric>Hectáreas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.variedad}>
                <TableCell className="font-medium">{f.variedad}</TableCell>
                <TableCell numeric>
                  <Input
                    type="number"
                    step="0.01"
                    name={`hectareas__${f.variedad}`}
                    defaultValue={f.hectareas ?? ""}
                    className="ml-auto w-[120px] text-right"
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
      {pending ? "Guardando..." : "Guardar hectáreas"}
    </Button>
  );
}
