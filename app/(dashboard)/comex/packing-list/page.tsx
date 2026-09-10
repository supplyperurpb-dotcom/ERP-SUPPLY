import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import type { EstadoPackingList } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoPackingList, string> = {
  BORRADOR: "Borrador",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
};

const ESTADO_VARIANT: Record<EstadoPackingList, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  EMITIDO: "success",
  ANULADO: "destructive",
};

export default async function PackingListPage() {
  const packingLists = await prisma.packingList.findMany({
    include: { embarque: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Packing list"
        descripcion="Packing list de exportación por contenedor/embarque, con el detalle de pallets, cajas y pesos por formato de presentación."
        acciones={
          <Button variant="outline" asChild>
            <a href="/api/pdf/test?tipo=packing-list" target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" />
              Generar PDF de prueba
            </a>
          </Button>
        }
      />

      {packingLists.length === 0 ? (
        <EmptyState
          icono={FileSpreadsheet}
          titulo="Aún no hay packing lists generados"
          descripcion="Los packing lists se generarán a partir de un embarque. Por ahora puedes previsualizar el formato de PDF interno con el botón de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Embarque</TableHead>
              <TableHead>Fecha de emisión</TableHead>
              <TableHead>N.º de ítems</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packingLists.map((pl) => (
              <TableRow key={pl.id}>
                <TableCell className="font-medium">{pl.numero}</TableCell>
                <TableCell>{pl.embarque.numero}</TableCell>
                <TableCell>{formatDate(pl.fechaEmision)}</TableCell>
                <TableCell>{pl._count.items}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[pl.estado]}>{ESTADO_LABEL[pl.estado]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
