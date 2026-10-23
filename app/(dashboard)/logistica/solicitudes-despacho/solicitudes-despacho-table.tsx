"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { eliminarSolicitudDespachoAction } from "@/lib/actions/solicitud-despacho-actions";

export type EstadoSolicitudDespacho = "PENDIENTE" | "PARCIAL" | "ATENDIDA";

const ESTADO_LABEL: Record<EstadoSolicitudDespacho, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  ATENDIDA: "Atendida",
};

const ESTADO_VARIANT: Record<EstadoSolicitudDespacho, "success" | "secondary"> = {
  PENDIENTE: "secondary",
  PARCIAL: "secondary",
  ATENDIDA: "success",
};

export type FilaSolicitudDespacho = {
  id: string;
  numero: string;
  almacen: string;
  almacenId: string;
  fecha: string;
  numItems: number;
  estado: EstadoSolicitudDespacho;
  puedeEliminar: boolean;
};

export function SolicitudesDespachoTable({ filas }: { filas: FilaSolicitudDespacho[] }) {
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
              <TableHead>Almacén</TableHead>
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
                <TableCell>{f.almacen}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABEL[f.estado]}</Badge>
                </TableCell>
                <TableCell className="text-right">{f.numItems}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/logistica/solicitudes-despacho/${f.id}`}>Ver</Link>
                    </Button>
                    {f.estado !== "ATENDIDA" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/logistica/almacenes/consumos/nuevo?almacenId=${f.almacenId}&solicitudDespachoId=${f.id}`}>
                          Atender
                        </Link>
                      </Button>
                    )}
                    {f.puedeEliminar && (
                      <EliminarMovimientoButton
                        id={f.id}
                        numero={f.numero}
                        etiqueta="la solicitud de despacho"
                        accion={eliminarSolicitudDespachoAction}
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
