import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";

export default async function TarjasPage() {
  const tarjas = await prisma.tarja.findMany({
    include: { pallet: { include: { ingresoFruta: { include: { proveedor: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Tarjas"
        descripcion="Ticket interno de pallet: detalle de bandejas, pesos, proveedor y variedad, generado a partir de un pallet registrado en Acopio."
      />

      {tarjas.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo="Aún no hay tarjas generadas"
          descripcion="Las tarjas se generan a partir de un pallet registrado dentro de un ingreso de fruta."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha de emisión</TableHead>
              <TableHead>Proveedor / Fundo</TableHead>
              <TableHead>Módulo / Variedad</TableHead>
              <TableHead>Peso neto del pallet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarjas.map((tarja) => (
              <TableRow key={tarja.id}>
                <TableCell className="font-medium">{tarja.numero}</TableCell>
                <TableCell>{formatDateTime(tarja.fechaEmision)}</TableCell>
                <TableCell>{tarja.pallet.ingresoFruta.proveedor.razonSocial}</TableCell>
                <TableCell>{tarja.pallet.modulo} / {tarja.pallet.variedad}</TableCell>
                <TableCell>{tarja.pallet.pesoNetoKg.toString()} kg</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
