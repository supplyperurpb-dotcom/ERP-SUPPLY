"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileDown, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AprobarRechazarBotones, AnularSolicitudBoton } from "./aprobar-rechazar-botones";
import type { EstadoDocumento } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ANULADO: "Anulada",
};

const ESTADO_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

export type FilaSolicitudPedido = {
  id: string;
  numero: string;
  categoria: "COMPRA" | "SERVICIO";
  categoriaLabel: string;
  area: string;
  tipoNecesidad: string;
  fecha: string;
  fechaNecesidad: string;
  estado: EstadoDocumento;
  numItems: number;
  puedeAprobar: boolean;
  puedeAnular: boolean;
  puedeGenerarOrden: boolean;
  tienePendiente: boolean;
};

export function SolicitudesPedidoTable({ filas }: { filas: FilaSolicitudPedido[] }) {
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
              <TableHead>Categoría</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Fecha necesidad</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">N.º de ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.numero}</TableCell>
                <TableCell>
                  <Badge variant={f.categoria === "SERVICIO" ? "secondary" : "success"}>{f.categoriaLabel}</Badge>
                </TableCell>
                <TableCell>{f.area}</TableCell>
                <TableCell>{f.tipoNecesidad}</TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell>{f.fechaNecesidad}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABEL[f.estado]}</Badge>
                </TableCell>
                <TableCell className="text-right">{f.numItems}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {f.puedeAprobar && <AprobarRechazarBotones id={f.id} numero={f.numero} />}
                    {f.puedeAnular && <AnularSolicitudBoton id={f.id} numero={f.numero} />}
                    <Button variant="outline" size="sm" asChild title="Vista previa en PDF">
                      <a href={`/api/pdf/solicitud-pedido/${f.id}`} target="_blank" rel="noopener noreferrer">
                        <FileDown className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/logistica/solicitudes-pedido/${f.id}`}>Ver</Link>
                    </Button>
                    {f.puedeGenerarOrden &&
                      f.estado === "APROBADO" &&
                      (f.tienePendiente ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/logistica/ordenes-compra/nuevo?categoria=${f.categoria}&solicitudId=${f.id}`}>
                            <ShoppingCart className="mr-1 h-4 w-4" />
                            Generar {f.categoria === "SERVICIO" ? "OS" : "OC"}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Ya no quedan ítems pendientes de esta solicitud para jalar a una orden"
                        >
                          <ShoppingCart className="mr-1 h-4 w-4" />
                          Generar {f.categoria === "SERVICIO" ? "OS" : "OC"}
                        </Button>
                      ))}
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
