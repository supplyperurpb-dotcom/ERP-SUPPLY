"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleActivoRetiradorAutorizadoAction } from "@/lib/actions/retirador-autorizado-actions";

export type FilaRetiradorAutorizado = {
  id: string;
  nombreCompleto: string;
  dni: string;
  area: string;
  almacenes: string[];
  activo: boolean;
};

export function RetiradoresAutorizadosTable({ filas }: { filas: FilaRetiradorAutorizado[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [isPending, startTransition] = useTransition();

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter((f) => f.nombreCompleto.toLowerCase().includes(termino) || f.dni.includes(termino));
  }, [filas, busqueda]);

  function handleToggle(fila: FilaRetiradorAutorizado) {
    startTransition(async () => {
      const resultado = await toggleActivoRetiradorAutorizadoAction(fila.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(fila.activo ? `${fila.nombreCompleto} desactivado` : `${fila.nombreCompleto} activado`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ningún retirador que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre completo</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Almacenes permitidos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.nombreCompleto}</TableCell>
                <TableCell>{f.dni}</TableCell>
                <TableCell>{f.area}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {f.almacenes.map((nombre) => (
                      <Badge key={nombre} variant="secondary">
                        {nombre}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={f.activo ? "success" : "secondary"}>{f.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/logistica/listas/retiradores-autorizados/${f.id}/editar`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleToggle(f)}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
