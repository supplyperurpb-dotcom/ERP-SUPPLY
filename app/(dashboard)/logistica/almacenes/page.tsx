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

const CATEGORIA_GENERAL_LABEL: Record<string, string> = {
  PACKING: "Packing",
  AGROQUIMICOS_FERTILIZANTES: "Agroquímicos y Fertilizantes",
  COMBUSTIBLE: "Combustible",
  SUMINISTROS: "Suministros",
};

export default async function AlmacenesPage() {
  const almacenes = await prisma.almacen.findMany({
    orderBy: [{ esGeneral: "desc" }, { codigo: "asc" }],
  });

  const almacenesGenerales = almacenes
    .filter((a) => a.esGeneral)
    .map((a) => ({ id: a.id, nombre: a.nombre }));
  const nombrePorId = new Map(almacenes.map((a) => [a.id, a.nombre]));

  return (
    <div>
      <PageHeader
        titulo="Almacenes"
        descripcion="Catálogo de almacenes generales (donde se registran los ingresos) y sus sub-almacenes (que reciben inventario por traslado)."
      />

      {almacenes.length === 0 ? (
        <EmptyState
          icono={Warehouse}
          titulo="Aún no hay almacenes registrados"
          descripcion="Los almacenes se crean fuera de la aplicación."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Jerarquía</TableHead>
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
                <TableCell>
                  {almacen.esGeneral ? (
                    <div className="space-y-1">
                      <Badge variant="success">General</Badge>
                      {almacen.categoriaGeneral && (
                        <p className="text-xs text-muted-foreground">
                          {CATEGORIA_GENERAL_LABEL[almacen.categoriaGeneral] ?? almacen.categoriaGeneral}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="secondary">Sub-almacén</Badge>
                      <p className="text-xs text-muted-foreground">
                        de {almacen.almacenPadreId ? (nombrePorId.get(almacen.almacenPadreId) ?? "—") : "—"}
                      </p>
                    </div>
                  )}
                </TableCell>
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
                  <AlmacenFormDialog almacen={almacen} almacenesGenerales={almacenesGenerales} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
