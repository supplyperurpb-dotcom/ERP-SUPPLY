"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Sku } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eliminarSkuAction } from "@/lib/actions/sku-actions";
import { SkuFormDialog } from "./sku-form-dialog";

export function SkuTable({ skus }: { skus: Sku[] }) {
  const [isPending, startTransition] = useTransition();

  function handleEliminar(id: string, codigo: string) {
    if (!confirm(`¿Eliminar el SKU ${codigo}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await eliminarSkuAction(id);
      toast.success("SKU eliminado");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skus.map((sku) => (
          <TableRow key={sku.id}>
            <TableCell className="font-medium">{sku.codigo}</TableCell>
            <TableCell>{sku.descripcion}</TableCell>
            <TableCell>{sku.categoria}</TableCell>
            <TableCell>{sku.unidadMedida}</TableCell>
            <TableCell>{sku.tipo === "INSUMO" ? "Insumo" : "Producto terminado"}</TableCell>
            <TableCell>
              <Badge variant={sku.activo ? "success" : "secondary"}>{sku.activo ? "Activo" : "Inactivo"}</Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <SkuFormDialog sku={sku} />
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleEliminar(sku.id, sku.codigo)}
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
