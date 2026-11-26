"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad, formatDate, formatMoneda } from "@/lib/utils";
import type { FilaReporteStock } from "@/lib/stock-almacen";

const POR_PAGINA = 50;

export function ReporteStockTable({
  filas,
  ocultarColumnaAlmacen = false,
}: {
  filas: FilaReporteStock[];
  /** El detalle de un almacén puntual ya sabe de cuál se trata — no hace falta repetirlo en cada fila. */
  ocultarColumnaAlmacen?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    setPagina(1);
  }

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter(
      (f) =>
        f.codigo.toLowerCase().includes(termino) ||
        f.descripcion.toLowerCase().includes(termino) ||
        f.almacenNombre.toLowerCase().includes(termino) ||
        (f.proveedorNombre ?? "").toLowerCase().includes(termino)
    );
  }, [filas, busqueda]);

  const valorizadoTotal = filasFiltradas.reduce((acc, f) => acc + (f.valorizado ?? 0), 0);

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = filasFiltradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, producto o almacén..."
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ningún producto en stock que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  {!ocultarColumnaAlmacen && <TableHead>Almacén</TableHead>}
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>F. Producción</TableHead>
                  <TableHead>F. Vencimiento</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>UM</TableHead>
                  <TableHead className="text-right">Precio ponderado</TableHead>
                  <TableHead className="text-right">Valorizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPagina.map((f, i) => (
                  <TableRow key={`${f.skuId}-${f.almacenId}-${f.lote ?? "sinlote"}-${i}`}>
                    <TableCell className="font-medium">{f.codigo}</TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    {!ocultarColumnaAlmacen && <TableCell>{f.almacenNombre}</TableCell>}
                    <TableCell>{f.proveedorNombre ?? "—"}</TableCell>
                    <TableCell>{f.lote ?? "—"}</TableCell>
                    <TableCell>{f.fechaProduccion ? formatDate(f.fechaProduccion) : "—"}</TableCell>
                    <TableCell>{f.fechaVencimiento ? formatDate(f.fechaVencimiento) : "—"}</TableCell>
                    <TableCell className="text-right">{formatCantidad(f.cantidad)}</TableCell>
                    <TableCell>{f.unidadMedida}</TableCell>
                    <TableCell className="text-right">
                      {f.precioUnitarioPonderado !== null ? formatMoneda(f.precioUnitarioPonderado, "USD") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {f.valorizado !== null ? formatMoneda(f.valorizado, "USD") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              {filasFiltradas.length} fila{filasFiltradas.length === 1 ? "" : "s"} · Página {paginaActual} de {totalPaginas} ·
              Valorizado total: <span className="font-medium text-foreground">{formatMoneda(valorizadoTotal, "USD")}</span>
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
        </>
      )}
    </div>
  );
}
