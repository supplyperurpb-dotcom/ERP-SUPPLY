import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatKg } from "@/lib/utils";
import { CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET } from "@/lib/constants/pallet";
import { TarjaBoton } from "./tarja-boton";

export default async function TarjasPage() {
  const pallets = await prisma.pallet.findMany({
    include: {
      tarja: true,
      lineas: { select: { modulo: true, variedad: true, ingresoFruta: { select: { proveedor: { select: { razonSocial: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Tarjas"
        descripcion="Etiqueta impresa (10 × 15 cm) de un pallet armado: módulo, variedad, cantidad de bandejas y peso neto. Se genera a partir de los pallets registrados en Ingresos de fruta."
      />

      {pallets.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo="Aún no hay pallets armados"
          descripcion="Los pallets se crean al registrar un ingreso de materia prima en Acopio."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pallet</TableHead>
              <TableHead>Proveedor / Fundo</TableHead>
              <TableHead>Módulos / Variedades</TableHead>
              <TableHead>Bandejas</TableHead>
              <TableHead>Peso neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Tarja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pallets.map((pallet) => {
              const proveedores = Array.from(
                new Set(pallet.lineas.map((l) => l.ingresoFruta.proveedor.razonSocial))
              ).join(", ");
              const detalle = Array.from(
                new Set(pallet.lineas.map((l) => `${l.modulo} / ${l.variedad}`))
              ).join(", ");
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
                  <TableCell className="text-right">
                    <TarjaBoton palletId={pallet.id} tarjaNumero={pallet.tarja?.numero ?? null} />
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
