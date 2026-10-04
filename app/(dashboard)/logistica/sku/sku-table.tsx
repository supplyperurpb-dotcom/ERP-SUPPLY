"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Sku } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eliminarSkuAction } from "@/lib/actions/sku-actions";
import { SkuFormDialog } from "./sku-form-dialog";

export function SkuTable({ skus, esAdmin }: { skus: Sku[]; esAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");

  const skusFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return skus;
    return skus.filter(
      (sku) => sku.codigo.toLowerCase().includes(termino) || sku.descripcion.toLowerCase().includes(termino)
    );
  }, [skus, busqueda]);

  function handleEliminar(id: string, codigo: string) {
    if (!confirm(`¿Eliminar el SKU ${codigo}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const resultado = await eliminarSkuAction(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("SKU eliminado");
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código o nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {skusFiltrados.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ningún SKU que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Subfamilia</TableHead>
              <TableHead>Estado</TableHead>
              {esAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {skusFiltrados.map((sku) => (
              <TableRow key={sku.id}>
                <TableCell className="font-medium">{sku.codigo}</TableCell>
                <TableCell>{sku.descripcion}</TableCell>
                <TableCell>{sku.categoria}</TableCell>
                <TableCell>{sku.unidadMedida}</TableCell>
                <TableCell>{sku.subfamilia}</TableCell>
                <TableCell>
                  <Badge variant={sku.activo ? "success" : "secondary"}>{sku.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                {esAdmin && (
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
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
