import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { Topbar } from "@/components/shared/topbar";
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
    <div className="flex h-screen overflow-hidden">
      <SidebarNav roles={usuario.roles} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar usuario={usuario} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
