import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatKg } from "@/lib/utils";
import { CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET } from "@/lib/constants/pallet";
import { TarjaIQFBoton } from "./tarja-iqf-boton";

export default async function TarjasIQFPage() {
  const pallets = await prisma.palletIQF.findMany({
    include: {
      tarja: { include: { despacho: true } },
      lineas: { select: { variedad: true, ingresoIQF: { select: { proveedor: { select: { razonSocial: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Tarjas IQF"
        descripcion="Etiqueta impresa (10 × 15 cm) de un pallet de descarte de planta armado en Ingreso IQF: variedad, cantidad de bandejas y peso neto. Independiente de las Tarjas de Ingreso de Materia Prima."
      />

      {pallets.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo="Aún no hay pallets IQF armados"
          descripcion="Los pallets IQF se crean al registrar un ingreso en Ingreso IQF."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pallet</TableHead>
              <TableHead>Fundo</TableHead>
              <TableHead>Variedades</TableHead>
              <TableHead>Bandejas</TableHead>
              <TableHead>Peso neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Despacho</TableHead>
              <TableHead className="text-right">Tarja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pallets.map((pallet) => {
              const proveedores = Array.from(
                new Set(pallet.lineas.map((l) => l.ingresoIQF.proveedor.razonSocial))
              ).join(", ");
              const detalle = Array.from(new Set(pallet.lineas.map((l) => l.variedad))).join(", ");
              return (
                <TableRow key={pallet.id}>
                  <TableCell className="font-medium">{pallet.numero}</TableCell>
                  <TableCell>{proveedores || "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={detalle}>
                    {detalle || "—"}
                  </TableCell>
                  <TableCell>
                    {pallet.cantidadBandejas} / {CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET}
                  </TableCell>
                  <TableCell>{formatKg(Number(pallet.pesoNetoKg))}</TableCell>
                  <TableCell>
                    <Badge variant={pallet.estado === "CERRADO" ? "success" : "secondary"}>
                      {pallet.estado === "CERRADO" ? "Cerrado" : "Abierto"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pallet.tarja?.despacho ? (
                      <Badge variant="success">{pallet.tarja.despacho.numero}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TarjaIQFBoton palletId={pallet.id} tarjaNumero={pallet.tarja?.numero ?? null} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
