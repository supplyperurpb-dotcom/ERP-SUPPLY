import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea } from "@/lib/compras";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { ROL_LABELS, type RolNombre } from "@/lib/auth/constants";

export default async function UsuariosPage() {
  const usuarioActual = await getUsuarioActual();
  if (!usuarioActual || !usuarioActual.roles.includes("ADMIN")) {
    redirect("/inicio");
  }

  const [usuarios, aprobadores] = await Promise.all([
    prisma.usuario.findMany({
      include: { asignacionesRol: { include: { rol: true } } },
      orderBy: { createdAt: "desc" },
    }),
    obtenerAprobadoresArea(),
  ]);

  const areaPorUsuarioId = new Map(aprobadores.map((a) => [a.usuarioId, a.area]));

  return (
    <div>
      <PageHeader
        titulo="Usuarios"
        descripcion="Cuentas con acceso al sistema y su rol: usuario aprobador (solo ve y aprueba solicitudes/órdenes de su área) o usuario regular."
        acciones={
          <Button asChild>
            <Link href="/usuarios/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo usuario
            </Link>
          </Button>
        }
      />

      {usuarios.length === 0 ? (
        <EmptyState icono={Users} titulo="Aún no hay usuarios" descripcion="Crea el primero con el botón de arriba." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Área que aprueba</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => {
              const roles = usuario.asignacionesRol.map((a) => a.rol.nombre as RolNombre);
              const area = areaPorUsuarioId.get(usuario.id);
              return (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">
                    {usuario.nombres} {usuario.apellidos}
                  </TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {roles.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        roles.map((r) => (
                          <Badge key={r} variant="secondary">
                            {ROL_LABELS[r] ?? r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{area ? AREAS_EMPRESA.find((a) => a.valor === area)?.nombre ?? area : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? "success" : "destructive"}>
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </Badge>
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
