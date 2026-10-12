"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleActivoVehiculoAction } from "@/lib/actions/vehiculo-actions";

export type FilaVehiculo = {
  id: string;
  placa: string;
  codigoEquipo: string | null;
  areaUsuaria: string;
  tipo: string;
  activo: boolean;
};

export function VehiculosTable({ filas }: { filas: FilaVehiculo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [isPending, startTransition] = useTransition();

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter(
      (f) => f.placa.toLowerCase().includes(termino) || (f.codigoEquipo ?? "").toLowerCase().includes(termino)
    );
  }, [filas, busqueda]);

  function handleToggle(fila: FilaVehiculo) {
    startTransition(async () => {
      const resultado = await toggleActivoVehiculoAction(fila.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(fila.activo ? `${fila.placa} desactivado` : `${fila.placa} activado`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por placa o código de equipo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ningún vehículo que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Código de equipo</TableHead>
              <TableHead>Área usuaria</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.placa}</TableCell>
                <TableCell>{f.codigoEquipo ?? "—"}</TableCell>
                <TableCell>{f.areaUsuaria}</TableCell>
                <TableCell>{f.tipo}</TableCell>
                <TableCell>
                  <Badge variant={f.activo ? "success" : "secondary"}>{f.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/logistica/listas/vehiculos/${f.id}/editar`}>
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
