import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import type { RolNombre } from "@/lib/auth/constants";
import { UsuarioEditarForm } from "./usuario-editar-form";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuarioActual = await getUsuarioActual();
  if (!usuarioActual || !usuarioActual.roles.includes("ADMIN")) {
    redirect("/inicio");
  }

  const [usuario, aprobadorEspecial] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id },
      include: { asignacionesRol: { include: { rol: true } }, accesoItems: { select: { href: true } } },
    }),
    prisma.aprobadorEspecial.findFirst({ where: { usuarioId: id } }),
  ]);

  if (!usuario) notFound();

  const roles = usuario.asignacionesRol.map((a) => a.rol.nombre as RolNombre);
  const tipoRol: "REGULAR" | "APROBADOR" | "APROBADOR_GENERAL" = roles.includes("APROBADOR_GENERAL")
    ? "APROBADOR_GENERAL"
    : roles.includes("APROBADOR")
      ? "APROBADOR"
      : "REGULAR";

  return (
    <div>
      <PageHeader
        titulo={`Editar: ${usuario.nombres} ${usuario.apellidos}`}
        descripcion="Actualiza sus datos, su rol y a qué módulos/submódulos tiene acceso."
      />
      <UsuarioEditarForm
        usuarioId={usuario.id}
        esUnoMismo={usuario.id === usuarioActual.id}
        esAdministrador={roles.includes("ADMIN")}
        valoresIniciales={{
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          email: usuario.email,
          dni: usuario.dni ?? "",
          telefono: usuario.telefono ?? "",
          cargo: usuario.cargo ?? "",
          nuevaPassword: "",
          tipoRol,
          area: usuario.area ?? "PRODUCCION",
          // GERENTE_RRHH se asigna aparte (ver nota en lib/validations/usuarios.ts)
          // y no es un valor válido en este formulario.
          rolEspecial:
            aprobadorEspecial?.rol && aprobadorEspecial.rol !== "GERENTE_RRHH" ? aprobadorEspecial.rol : undefined,
          accesoHrefs: usuario.accesoItems.map((a) => a.href),
          activo: usuario.activo,
        }}
      />
    </div>
  );
}
