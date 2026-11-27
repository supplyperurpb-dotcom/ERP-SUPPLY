import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCantidad, formatDate } from "@/lib/utils";
import type { FilaMovimientoGlobal, TipoMovimientoGlobal } from "@/lib/stock-almacen";

const TIPO_LABEL: Record<TipoMovimientoGlobal, string> = {
  INGRESO: "Ingreso",
  TRASLADO: "Traslado",
  CONSUMO: "Consumo",
  DEVOLUCION: "Devolución",
};

// Mismos colores que HistorialMovimientosTable (pedido explícito,
// 2026-11-25): Ingreso verde, Consumo rojo, Traslado ámbar, Devolución azul.
const TIPO_COLOR: Record<TipoMovimientoGlobal, string> = {
  INGRESO: "text-green-600 dark:text-green-500",
  TRASLADO: "text-amber-600 dark:text-amber-500",
  CONSUMO: "text-red-600 dark:text-red-500",
  DEVOLUCION: "text-blue-600 dark:text-blue-500",
};

const TIPO_BADGE_BG: Record<TipoMovimientoGlobal, string> = {
  INGRESO: "bg-green-100 dark:bg-green-950",
  TRASLADO: "bg-amber-100 dark:bg-amber-950",
  CONSUMO: "bg-red-100 dark:bg-red-950",
  DEVOLUCION: "bg-blue-100 dark:bg-blue-950",
};

function hrefDocumento(tipo: TipoMovimientoGlobal, documentoId: string): string {
  switch (tipo) {
    case "INGRESO":
      return `/logistica/almacenes/ingresos/${documentoId}`;
    case "TRASLADO":
      return `/logistica/almacenes/traslados/${documentoId}`;
    case "CONSUMO":
      return `/logistica/almacenes/consumos/${documentoId}`;
    case "DEVOLUCION":
      return `/logistica/almacenes/devoluciones/${documentoId}`;
  }
}

export function MovimientosTable({ filas }: { filas: FilaMovimientoGlobal[] }) {
  if (filas.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Ningún movimiento coincide con el filtro elegido.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>N.º</TableHead>
            <TableHead>Almacén</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>UM</TableHead>
            <TableHead>Proveedor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => (
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
              <TableCell>{f.almacen}</TableCell>
              <TableCell className="font-medium">{f.codigo}</TableCell>
              <TableCell>{f.descripcion}</TableCell>
              <TableCell className="text-right">{formatCantidad(f.cantidad)}</TableCell>
              <TableCell>{f.unidadMedida}</TableCell>
              <TableCell>{f.proveedorNombre ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
