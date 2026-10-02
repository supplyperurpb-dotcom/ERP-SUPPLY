import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getUsuarioActual } from "@/lib/auth/session";
import { UsuarioForm } from "./usuario-form";

export default async function NuevoUsuarioPage() {
  const usuarioActual = await getUsuarioActual();
  if (!usuarioActual || !usuarioActual.roles.includes("ADMIN")) {
    redirect("/inicio");
  }

  return (
    <div>
      <PageHeader
        titulo="Nuevo usuario"
        descripcion="Crea una cuenta de acceso y asigna su rol: usuario regular o usuario aprobador de un área específica."
      />
      <UsuarioForm />
    </div>
  );
}
