"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Proveedor } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eliminarProveedorAction } from "@/lib/actions/proveedor-actions";
import { ProveedorFormDialog } from "./proveedor-form-dialog";

const TIPO_LABEL: Record<Proveedor["tipo"], string> = {
  INSUMOS: "Insumos",
  FUNDO: "Fundo",
  AMBOS: "Ambos",
};

export function ProveedorTable({ proveedores }: { proveedores: Proveedor[] }) {
  const [isPending, startTransition] = useTransition();

  function handleEliminar(id: string, razonSocial: string) {
    if (!confirm(`¿Eliminar el proveedor ${razonSocial}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await eliminarProveedorAction(id);
      toast.success("Proveedor eliminado");
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Documento</TableHead>
          <TableHead>Razón social</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proveedores.map((proveedor) => (
          <TableRow key={proveedor.id}>
            <TableCell className="font-medium">
              {proveedor.tipoDocumento} {proveedor.numeroDocumento}
            </TableCell>
            <TableCell>
              {proveedor.razonSocial}
              {proveedor.nombreComercial && (
                <p className="text-xs text-muted-foreground">{proveedor.nombreComercial}</p>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{TIPO_LABEL[proveedor.tipo]}</Badge>
            </TableCell>
            <TableCell>{proveedor.telefono || proveedor.email || "—"}</TableCell>
            <TableCell>
              <Badge variant={proveedor.activo ? "success" : "secondary"}>
                {proveedor.activo ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <ProveedorFormDialog proveedor={proveedor} />
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleEliminar(proveedor.id, proveedor.razonSocial)}
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
