"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnularOrdenBoton } from "./aprobar-rechazar-botones";
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

export type FilaOrdenCompra = {
  id: string;
  numero: string;
  categoria: "COMPRA" | "SERVICIO";
  categoriaLabel: string;
  proveedorRazonSocial: string;
  estado: EstadoDocumento;
  fecha: string;
  subtotal: string;
  igv: string;
  montoTotal: string;
  puedeAnular: boolean;
};

export function OrdenesCompraTable({ filas }: { filas: FilaOrdenCompra[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter(
      (f) => f.numero.toLowerCase().includes(termino) || f.proveedorRazonSocial.toLowerCase().includes(termino)
    );
  }, [filas, busqueda]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número de OC/OS o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ninguna orden que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">IGV</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
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
                <TableCell>{f.proveedorRazonSocial}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABEL[f.estado]}</Badge>
                </TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell className="text-right">{f.subtotal}</TableCell>
                <TableCell className="text-right">{f.igv}</TableCell>
                <TableCell className="text-right font-medium">{f.montoTotal}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {f.puedeAnular && <AnularOrdenBoton id={f.id} numero={f.numero} />}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/logistica/ordenes-compra/${f.id}`}>Ver</Link>
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
