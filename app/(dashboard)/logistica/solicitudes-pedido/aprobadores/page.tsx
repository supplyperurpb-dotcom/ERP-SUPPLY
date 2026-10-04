import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea, obtenerAprobadoresEspeciales } from "@/lib/compras";
import { AREAS_EMPRESA, ROLES_APROBADOR_ESPECIAL, type AreaEmpresaCodigo, type RolAprobadorEspecialCodigo } from "@/lib/constants/compras";
import { AprobadoresAreaForm } from "./aprobadores-area-form";
import { AprobadoresEspecialesForm } from "./aprobadores-especiales-form";

export default async function AprobadoresAreaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    redirect("/logistica/solicitudes-pedido");
  }

  const [usuarios, aprobadores, aprobadoresEspeciales] = await Promise.all([
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombres: "asc" } }),
    obtenerAprobadoresArea(),
    obtenerAprobadoresEspeciales(),
  ]);

  const asignacionesIniciales = AREAS_EMPRESA.reduce((acc, a) => {
    acc[a.valor] = aprobadores.find((ap) => ap.area === a.valor)?.usuarioId ?? "";
    return acc;
  }, {} as Record<AreaEmpresaCodigo, string>);

  const asignacionesEspecialesIniciales = ROLES_APROBADOR_ESPECIAL.reduce((acc, r) => {
    acc[r.valor] = aprobadoresEspeciales.find((ap) => ap.rol === r.valor)?.usuarioId ?? "";
    return acc;
  }, {} as Record<RolAprobadorEspecialCodigo, string>);

  const opcionesUsuarios = usuarios.map((u) => ({ id: u.id, nombre: `${u.nombres} ${u.apellidos}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Aprobadores por área"
        descripcion="Configura qué usuario aprueba las solicitudes de pedido de cada área, y qué usuario ocupa cada rol especial de aprobación."
      />
      <AprobadoresAreaForm usuarios={opcionesUsuarios} asignacionesIniciales={asignacionesIniciales} />
      <AprobadoresEspecialesForm usuarios={opcionesUsuarios} asignacionesIniciales={asignacionesEspecialesIniciales} />
    </div>
  );
}
