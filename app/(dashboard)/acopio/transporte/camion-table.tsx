"use client";

import { useTransition } from "react";
import { Power } from "lucide-react";
import { toast } from "sonner";
import type { Camion } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIPOS_CAMION } from "@/lib/validations/transporte";
import { toggleActivoCamionAction } from "@/lib/actions/transporte-actions";
import { CamionFormDialog } from "./camion-form-dialog";

const TIPO_LABEL = Object.fromEntries(TIPOS_CAMION.map((t) => [t.valor, t.nombre])) as Record<Camion["tipo"], string>;

export function CamionTable({ camiones }: { camiones: Camion[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(camion: Camion) {
    startTransition(async () => {
      const resultado = await toggleActivoCamionAction(camion.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(camion.activo ? `${camion.placa} desactivado` : `${camion.placa} activado`);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Placa</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {camiones.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.placa}</TableCell>
            <TableCell>{TIPO_LABEL[c.tipo]}</TableCell>
            <TableCell>
              <Badge variant={c.activo ? "success" : "secondary"}>{c.activo ? "Activo" : "Inactivo"}</Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <CamionFormDialog camion={c} />
              <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleToggle(c)}>
                <Power className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
