import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { TipoMovimientoStock } from "@prisma/client";

const TIPO_LABEL: Record<TipoMovimientoStock, string> = {
  INGRESO: "Ingreso",
  SALIDA: "Salida",
  TRANSFERENCIA: "Transferencia",
};

const TIPO_VARIANT: Record<TipoMovimientoStock, "success" | "destructive" | "secondary"> = {
  INGRESO: "success",
  SALIDA: "destructive",
  TRANSFERENCIA: "secondary",
};

export default async function InventarioPage() {
  const movimientos = await prisma.movimientoStock.findMany({
    include: { sku: true, almacenOrigen: true, almacenDestino: true },
    orderBy: { fecha: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Inventario"
        descripcion="Historial de movimientos de stock de insumos y materiales: ingresos, salidas y transferencias entre almacenes."
      />

      {movimientos.length === 0 ? (
        <EmptyState
          icono={ArrowLeftRight}
          titulo="Aún no hay movimientos de inventario"
          descripcion="Los movimientos de stock se registrarán automáticamente a partir de órdenes de compra, ingresos de fruta y transferencias entre almacenes."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Almacén origen</TableHead>
              <TableHead>Almacén destino</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.map((movimiento) => (
              <TableRow key={movimiento.id}>
                <TableCell>{formatDateTime(movimiento.fecha)}</TableCell>
                <TableCell className="font-medium">
                  {movimiento.sku.codigo} - {movimiento.sku.descripcion}
                </TableCell>
                <TableCell>
                  <Badge variant={TIPO_VARIANT[movimiento.tipo]}>{TIPO_LABEL[movimiento.tipo]}</Badge>
                </TableCell>
                <TableCell>
                  {movimiento.cantidad.toString()} {movimiento.unidadMedida}
                </TableCell>
                <TableCell>{movimiento.almacenOrigen?.nombre ?? "—"}</TableCell>
                <TableCell>{movimiento.almacenDestino?.nombre ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
