"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { Topbar } from "@/components/shared/topbar";
import type { RolNombre } from "@/lib/auth/constants";
import type { UsuarioActual } from "@/lib/auth/session";

export function DashboardShell({
  roles,
  usuario,
  children,
}: {
  roles: RolNombre[];
  usuario: UsuarioActual;
  children: React.ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      <SidebarNav roles={roles} abierto={menuAbierto} onNavegar={() => setMenuAbierto(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar usuario={usuario} onAbrirMenu={() => setMenuAbierto(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
