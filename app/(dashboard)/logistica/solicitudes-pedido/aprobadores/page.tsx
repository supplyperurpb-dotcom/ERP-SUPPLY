import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea } from "@/lib/compras";
import { AREAS_EMPRESA, type AreaEmpresaCodigo } from "@/lib/constants/compras";
import { AprobadoresAreaForm } from "./aprobadores-area-form";

export default async function AprobadoresAreaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    redirect("/logistica/solicitudes-pedido");
  }

  const [usuarios, aprobadores] = await Promise.all([
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombres: "asc" } }),
    obtenerAprobadoresArea(),
  ]);

  const asignacionesIniciales = AREAS_EMPRESA.reduce((acc, a) => {
    acc[a.valor] = aprobadores.find((ap) => ap.area === a.valor)?.usuarioId ?? "";
    return acc;
  }, {} as Record<AreaEmpresaCodigo, string>);

  return (
    <div>
      <PageHeader
        titulo="Aprobadores por área"
        descripcion="Configura qué usuario aprueba las solicitudes de pedido de cada área."
      />
      <AprobadoresAreaForm
        usuarios={usuarios.map((u) => ({ id: u.id, nombre: `${u.nombres} ${u.apellidos}` }))}
        asignacionesIniciales={asignacionesIniciales}
      />
    </div>
  );
}
