import Link from "next/link";
import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TipoAlmacen } from "@prisma/client";
import { AlmacenFormDialog } from "./almacen-form-dialog";

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
        acciones={<AlmacenFormDialog />}
      />

      {almacenes.length === 0 ? (
        <EmptyState
          icono={Warehouse}
          titulo="Aún no hay almacenes registrados"
          descripcion="Crea el primer almacén con el botón 'Nuevo almacén' de arriba."
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
              <TableHead className="text-right">Acciones</TableHead>
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
                <TableCell className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/almacenes/${almacen.id}`}>Ver stock</Link>
                  </Button>
                  <AlmacenFormDialog almacen={almacen} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
