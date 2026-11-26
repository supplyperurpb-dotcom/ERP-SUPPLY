import Link from "next/link";
import { ArrowLeftRight, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatCantidad, serializar } from "@/lib/utils";
import { calcularReporteStock } from "@/lib/stock-almacen";
import { ReporteStockTable } from "./reporte-stock-table";
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
  const [filasStock, movimientos] = await Promise.all([
    calcularReporteStock(),
    prisma.movimientoStock.findMany({
      include: { sku: true, almacenOrigen: true, almacenDestino: true },
      orderBy: { fecha: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Inventario"
        descripcion="Stock actual valorizado de insumos y materiales, y el historial de movimientos entre almacenes."
      />

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-3">
          {filasStock.length === 0 ? (
            <EmptyState
              icono={ArrowLeftRight}
              titulo="Aún no hay stock registrado"
              descripcion="El stock se calcula automáticamente a partir de los ingresos, traslados y consumos de almacén."
            />
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="outline" asChild>
                  <Link href="/api/excel/inventario">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar a Excel
                  </Link>
                </Button>
              </div>
              <ReporteStockTable filas={serializar(filasStock)} />
            </>
          )}
        </TabsContent>

        <TabsContent value="movimientos">
          {movimientos.length === 0 ? (
            <EmptyState
              icono={ArrowLeftRight}
              titulo="Aún no hay movimientos de inventario"
              descripcion="Los movimientos de stock se registrarán automáticamente a partir de órdenes de compra, ingresos de fruta y transferencias entre almacenes."
            />
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
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
                      {formatCantidad(movimiento.cantidad.toString())} {movimiento.unidadMedida}
                    </TableCell>
                    <TableCell>{movimiento.almacenOrigen?.nombre ?? "—"}</TableCell>
                    <TableCell>{movimiento.almacenDestino?.nombre ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
