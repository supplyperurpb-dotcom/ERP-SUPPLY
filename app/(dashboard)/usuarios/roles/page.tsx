import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { ROL_LABELS, type RolNombre } from "@/lib/auth/constants";

export default async function RolesPage() {
  const roles = await prisma.rol.findMany({
    include: { _count: { select: { asignaciones: true, permisos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Roles"
        descripcion="Roles del sistema y su alcance por módulo. La edición de permisos y la asignación de roles a usuarios se habilitarán en una fase posterior."
      />

      {roles.length === 0 ? (
        <EmptyState
          icono={ShieldCheck}
          titulo="Aún no hay roles registrados"
          descripcion="Corre el seed del proyecto (npm run prisma:seed) para crear los roles base del sistema."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Usuarios asignados</TableHead>
              <TableHead>Permisos configurados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((rol) => (
              <TableRow key={rol.id}>
                <TableCell className="font-medium">{ROL_LABELS[rol.nombre as RolNombre] ?? rol.nombre}</TableCell>
                <TableCell>{rol.descripcion ?? "—"}</TableCell>
                <TableCell>{rol._count.asignaciones}</TableCell>
                <TableCell>{rol._count.permisos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
