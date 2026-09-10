import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { getUsuarioActual } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();

  // El middleware ya protege las rutas, pero si el registro en la tabla
  // Usuario no existe (p. ej. cuenta creada en Supabase Auth pero aún no
  // vinculada) no debe quedar atrapado en el dashboard sin datos.
  if (!usuario) {
    redirect("/login");
  }

  return (
    <DashboardShell roles={usuario.roles} usuario={usuario}>
      {children}
    </DashboardShell>
  );
}
