import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { ConfirmDialogProvider } from "@/components/shared/confirm-dialog-provider";
import { getUsuarioActual } from "@/lib/auth/session";
import { rutaPermitida } from "@/lib/auth/acceso-modulos";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();

  // El middleware ya protege las rutas, pero si el registro en la tabla
  // Usuario no existe (p. ej. cuenta creada en Supabase Auth pero aún no
  // vinculada) no debe quedar atrapado en el dashboard sin datos.
  if (!usuario) {
    redirect("/login");
  }

  // Hasta acá, el acceso por módulo/submódulo (ver UsuarioAccesoItem) solo
  // se aplicaba al sidebar/Inicio — entrar por URL directa a un módulo no
  // marcado igual funcionaba. Esto lo bloquea de verdad.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!rutaPermitida(usuario.roles, usuario.accesoHrefs, pathname)) {
    redirect("/inicio");
  }

  return (
    <DashboardShell roles={usuario.roles} usuario={usuario}>
      <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
    </DashboardShell>
  );
}
