"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TipoBandeja } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eliminarTipoBandejaAction } from "@/lib/actions/tara-actions";
import { TipoBandejaFormDialog } from "./tipo-bandeja-form-dialog";

export function TipoBandejaTable({ tiposBandeja }: { tiposBandeja: TipoBandeja[] }) {
  const [isPending, startTransition] = useTransition();

  function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el tipo de bandeja ${nombre}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await eliminarTipoBandejaAction(id);
      toast.success("Tipo de bandeja eliminado");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Peso tara (kg)</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tiposBandeja.map((tipoBandeja) => (
          <TableRow key={tipoBandeja.id}>
            <TableCell className="font-medium">{tipoBandeja.nombre}</TableCell>
            <TableCell>{tipoBandeja.pesoTaraKg.toString()}</TableCell>
            <TableCell>
              <Badge variant={tipoBandeja.activo ? "success" : "secondary"}>
                {tipoBandeja.activo ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <TipoBandejaFormDialog tipoBandeja={tipoBandeja} />
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleEliminar(tipoBandeja.id, tipoBandeja.nombre)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
