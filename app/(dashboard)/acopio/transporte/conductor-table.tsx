"use client";

import { useTransition } from "react";
import { Power } from "lucide-react";
import { toast } from "sonner";
import type { Conductor } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleActivoConductorAction } from "@/lib/actions/transporte-actions";
import { TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE } from "@/lib/validations/vehiculo-transporte";
import { ConductorFormDialog } from "./conductor-form-dialog";

export function ConductorTable({ conductores }: { conductores: Conductor[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(conductor: Conductor) {
    startTransition(async () => {
      const resultado = await toggleActivoConductorAction(conductor.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(conductor.activo ? `${conductor.nombre} desactivado` : `${conductor.nombre} activado`);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>DNI</TableHead>
          <TableHead>Licencia</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {conductores.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.nombre}</TableCell>
            <TableCell>{TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE.find((t) => t.valor === c.tipo)?.nombre ?? c.tipo}</TableCell>
            <TableCell className="font-mono">{c.dni}</TableCell>
            <TableCell className="font-mono">{c.licenciaConducir}</TableCell>
            <TableCell>
              <Badge variant={c.activo ? "success" : "secondary"}>{c.activo ? "Activo" : "Inactivo"}</Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <ConductorFormDialog conductor={c} />
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
