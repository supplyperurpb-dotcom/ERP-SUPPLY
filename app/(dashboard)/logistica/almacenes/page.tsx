import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TipoAlmacen } from "@prisma/client";

const TIPO_LABEL: Record<TipoAlmacen, string> = {
  INSUMOS: "Insumos",
  AGROQUIMICOS: "Agroquímicos",
  MATERIAL_EMPAQUE: "Material de empaque",
  CAMARA_FRIO: "Cámara de frío",
  OTRO: "Otro",
};

export default async function AlmacenesPage() {
  const almacenes = await prisma.almacen.findMany({
    orderBy: { codigo: "asc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Almacenes"
        descripcion="Catálogo de almacenes y cámaras de frío de la planta, usados como origen o destino de los movimientos de inventario."
      />

      {almacenes.length === 0 ? (
        <EmptyState
          icono={Warehouse}
          titulo="Aún no hay almacenes registrados"
          descripcion="En una fase futura podrás crear y administrar los almacenes de insumos, agroquímicos, material de empaque y cámaras de frío desde aquí."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {almacenes.map((almacen) => (
              <TableRow key={almacen.id}>
                <TableCell className="font-medium">{almacen.codigo}</TableCell>
                <TableCell>{almacen.nombre}</TableCell>
                <TableCell>{TIPO_LABEL[almacen.tipo]}</TableCell>
                <TableCell>{almacen.ubicacion ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={almacen.activo ? "success" : "secondary"}>
                    {almacen.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
