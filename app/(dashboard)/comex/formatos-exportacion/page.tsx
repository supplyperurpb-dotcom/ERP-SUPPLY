import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

export default async function FormatosExportacionPage() {
  const formatos = await prisma.formatoExportacion.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        titulo="Formatos de exportación"
        descripcion="Catálogo de formatos de presentación de producto terminado (clamshell, oz, granel, etc.) usado en stock de cámara y packing list."
      />

      {formatos.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo="Aún no hay formatos de exportación registrados"
          descripcion="Corre el seed del proyecto (npm run prisma:seed) o crea el primer formato para poder segmentar el stock de cámara."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Peso neto unitario (g)</TableHead>
              <TableHead>Unidades por caja</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formatos.map((formato) => (
              <TableRow key={formato.id}>
                <TableCell className="font-medium">{formato.codigo}</TableCell>
                <TableCell>{formato.nombre}</TableCell>
                <TableCell>{formato.pesoNetoUnitarioG?.toString() ?? "—"}</TableCell>
                <TableCell>{formato.unidadesPorCaja ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={formato.activo ? "success" : "secondary"}>
                    {formato.activo ? "Activo" : "Inactivo"}
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
