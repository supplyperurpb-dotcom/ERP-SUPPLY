"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCantidad, formatDate, formatMoneda } from "@/lib/utils";
import type { FilaMovimientoAlmacen, TipoMovimientoAlmacen } from "@/lib/stock-almacen";

const POR_PAGINA = 50;

const TIPO_LABEL: Record<TipoMovimientoAlmacen, string> = {
  INGRESO: "Ingreso",
  TRASLADO_ENTRADA: "Traslado (entrada)",
  TRASLADO_SALIDA: "Traslado (salida)",
  CONSUMO: "Consumo",
  DEVOLUCION: "Devolución",
};

// Colores pedidos explícitamente (2026-11-25): Ingreso verde, Consumo
// rojo, Traslado ámbar (entra o sale), Devolución azul.
const TIPO_COLOR: Record<TipoMovimientoAlmacen, string> = {
  INGRESO: "text-green-600 dark:text-green-500",
  TRASLADO_ENTRADA: "text-amber-600 dark:text-amber-500",
  TRASLADO_SALIDA: "text-amber-600 dark:text-amber-500",
  CONSUMO: "text-red-600 dark:text-red-500",
  DEVOLUCION: "text-blue-600 dark:text-blue-500",
};

const TIPO_BADGE_BG: Record<TipoMovimientoAlmacen, string> = {
  INGRESO: "bg-green-100 dark:bg-green-950",
  TRASLADO_ENTRADA: "bg-amber-100 dark:bg-amber-950",
  TRASLADO_SALIDA: "bg-amber-100 dark:bg-amber-950",
  CONSUMO: "bg-red-100 dark:bg-red-950",
  DEVOLUCION: "bg-blue-100 dark:bg-blue-950",
};

function hrefDocumento(tipo: TipoMovimientoAlmacen, documentoId: string): string {
  switch (tipo) {
    case "INGRESO":
      return `/logistica/almacenes/ingresos/${documentoId}`;
    case "TRASLADO_ENTRADA":
    case "TRASLADO_SALIDA":
      return `/logistica/almacenes/traslados/${documentoId}`;
    case "CONSUMO":
      return `/logistica/almacenes/consumos/${documentoId}`;
    case "DEVOLUCION":
      return `/logistica/almacenes/devoluciones/${documentoId}`;
  }
}

export function HistorialMovimientosTable({ filas }: { filas: FilaMovimientoAlmacen[] }) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = useMemo(
    () => filas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA),
    [filas, paginaActual]
  );

  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin movimientos registrados en este almacén.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>N.º</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>UM</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>F. Producción</TableHead>
              <TableHead>F. Vencimiento</TableHead>
              <TableHead className="text-right">PU</TableHead>
              <TableHead className="text-right">Ponderado</TableHead>
              <TableHead className="text-right">Valorizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasPagina.map((f) => (
              <TableRow key={`${f.tipo}-${f.id}`}>
                <TableCell>{formatDate(f.fecha)}</TableCell>
                <TableCell>
                  <span className={cn("rounded px-2 py-0.5 text-xs font-medium", TIPO_BADGE_BG[f.tipo], TIPO_COLOR[f.tipo])}>
                    {TIPO_LABEL[f.tipo]}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={hrefDocumento(f.tipo, f.documentoId)} className="text-primary hover:underline">
                    {f.documentoNumero}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{f.codigo}</TableCell>
                <TableCell>{f.descripcion}</TableCell>
                <TableCell>{f.unidadMedida}</TableCell>
                <TableCell className={cn("text-right font-medium", TIPO_COLOR[f.tipo])}>
                  {f.cantidad > 0 ? "+" : ""}
                  {formatCantidad(f.cantidad)}
                </TableCell>
                <TableCell>{f.lote ?? "—"}</TableCell>
                <TableCell>{f.fechaProduccion ? formatDate(f.fechaProduccion) : "—"}</TableCell>
                <TableCell>{f.fechaVencimiento ? formatDate(f.fechaVencimiento) : "—"}</TableCell>
                <TableCell className="text-right">{formatMoneda(f.precioUnitario, "USD")}</TableCell>
                <TableCell className="text-right">
                  {f.precioPonderado !== null ? formatMoneda(f.precioPonderado, "USD") : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-medium", TIPO_COLOR[f.tipo])}>
                  {f.valorizado !== null ? formatMoneda(f.valorizado, "USD") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {filas.length} movimiento{filas.length === 1 ? "" : "s"} · Página {paginaActual} de {totalPaginas}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={paginaActual <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
