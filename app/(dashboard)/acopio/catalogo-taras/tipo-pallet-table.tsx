"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TipoPallet } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eliminarTipoPalletAction } from "@/lib/actions/tara-actions";
import { TipoPalletFormDialog } from "./tipo-pallet-form-dialog";

export function TipoPalletTable({ tiposPallet }: { tiposPallet: TipoPallet[] }) {
  const [isPending, startTransition] = useTransition();

  function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el tipo de pallet ${nombre}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await eliminarTipoPalletAction(id);
      toast.success("Tipo de pallet eliminado");
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
        {tiposPallet.map((tipoPallet) => (
          <TableRow key={tipoPallet.id}>
            <TableCell className="font-medium">{tipoPallet.nombre}</TableCell>
            <TableCell>{tipoPallet.pesoTaraKg.toString()}</TableCell>
            <TableCell>
              <Badge variant={tipoPallet.activo ? "success" : "secondary"}>
                {tipoPallet.activo ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <TipoPalletFormDialog tipoPallet={tipoPallet} />
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleEliminar(tipoPallet.id, tipoPallet.nombre)}
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
