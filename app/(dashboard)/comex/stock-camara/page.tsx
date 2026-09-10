import { Thermometer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

export default async function StockCamaraPage() {
  const stock = await prisma.stockCamara.findMany({
    include: { formatoExportacion: true, almacen: true, cliente: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Stock de cámara"
        descripcion="Disponibilidad de producto terminado en cámara de frío, segmentada por formato de exportación, lote y cliente/destino, para armar embarques."
      />

      {stock.length === 0 ? (
        <EmptyState
          icono={Thermometer}
          titulo="Aún no hay stock de cámara registrado"
          descripcion="El stock de cámara se actualizará a partir de los ingresos de producto terminado a la cámara de frío."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formato de exportación</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Almacén (cámara)</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cantidad disponible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.formatoExportacion.nombre}</TableCell>
                <TableCell>{item.lote}</TableCell>
                <TableCell>{item.almacen.nombre}</TableCell>
                <TableCell>{item.cliente?.razonSocial ?? "—"}</TableCell>
                <TableCell>
                  {item.cantidadDisponible.toString()} {item.unidadMedida}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
