"use client";

import { useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import type { FilaReporteStock, FilaMovimientoAlmacen } from "@/lib/stock-almacen";
import { ReporteStockTable } from "../../inventario/reporte-stock-table";
import { HistorialMovimientosTable } from "./historial-movimientos-table";

// Un solo buscador para "Stock actual" e "Historial de movimientos"
// (pedido explícito, 2026-11-26) — antes cada tabla tenía su propio
// filtro (la de movimientos ni siquiera tenía uno).
export function AlmacenStockMovimientos({
  stock,
  movimientos,
}: {
  stock: FilaReporteStock[];
  movimientos: FilaMovimientoAlmacen[];
}) {
  const [busqueda, setBusqueda] = useState("");

  return (
    <>
      <section>
        <h2 className="mb-3 text-base font-semibold">Stock actual</h2>
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, producto, proveedor o lote..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
          {stock.length === 0 ? (
            <EmptyState
              icono={PackagePlus}
              titulo="Sin stock registrado"
              descripcion="Registra un ingreso para este almacén y aparecerá aquí."
            />
          ) : (
            <ReporteStockTable filas={stock} ocultarColumnaAlmacen busquedaExterna={busqueda} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Historial de movimientos</h2>
        <HistorialMovimientosTable filas={movimientos} busqueda={busqueda} />
      </section>
    </>
  );
}
