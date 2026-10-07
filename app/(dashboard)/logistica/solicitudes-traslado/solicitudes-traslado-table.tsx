"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { eliminarSolicitudTrasladoAction } from "@/lib/actions/solicitud-traslado-actions";

export type EstadoSolicitudTraslado = "PENDIENTE" | "PARCIAL" | "EJECUTADA";

const ESTADO_LABEL: Record<EstadoSolicitudTraslado, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  EJECUTADA: "Ejecutada",
};

const ESTADO_VARIANT: Record<EstadoSolicitudTraslado, "success" | "secondary"> = {
  PENDIENTE: "secondary",
  PARCIAL: "secondary",
  EJECUTADA: "success",
};

export type FilaSolicitudTraslado = {
  id: string;
  numero: string;
  almacenOrigen: string;
  almacenDestino: string;
  fecha: string;
  numItems: number;
  estado: EstadoSolicitudTraslado;
  puedeEliminar: boolean;
};

export function SolicitudesTrasladoTable({ filas }: { filas: FilaSolicitudTraslado[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter((f) => f.numero.toLowerCase().includes(termino));
  }, [filas, busqueda]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número de solicitud..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ninguna solicitud que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">N.º de ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.numero}</TableCell>
                <TableCell>{f.almacenOrigen}</TableCell>
                <TableCell>{f.almacenDestino}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABEL[f.estado]}</Badge>
                </TableCell>
                <TableCell className="text-right">{f.numItems}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="outline" size="sm" asChild title="Vista previa en PDF">
                      <a href={`/api/pdf/solicitud-traslado/${f.id}`} target="_blank" rel="noopener noreferrer">
                        <FileDown className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/logistica/solicitudes-traslado/${f.id}`}>Ver</Link>
                    </Button>
                    {f.puedeEliminar && (
                      <EliminarMovimientoButton
                        id={f.id}
                        numero={f.numero}
                        etiqueta="la solicitud de traslado"
                        accion={eliminarSolicitudTrasladoAction}
                      />
                    )}
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
