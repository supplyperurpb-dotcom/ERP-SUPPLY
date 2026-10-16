"use client";

import { useEffect, useState } from "react";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { Topbar } from "@/components/shared/topbar";
import type { RolNombre } from "@/lib/auth/constants";
import type { UsuarioActual } from "@/lib/auth/session";

// Se recuerda entre sesiones para que, p. ej., alguien viendo seguido el
// Resumen de Exportaciones no tenga que volver a ocultar el menú cada vez.
const CLAVE_SIDEBAR_COLAPSADO = "sidebar-colapsado";

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
  // Colapsar el menú lateral (solo escritorio) para ganar ancho en
  // dashboards con muchos gráficos/tarjetas.
  const [sidebarColapsado, setSidebarColapsado] = useState(false);

  useEffect(() => {
    try {
      setSidebarColapsado(localStorage.getItem(CLAVE_SIDEBAR_COLAPSADO) === "1");
    } catch {
      // localStorage puede no estar disponible (ventana privada, etc.) — se queda expandido.
    }
  }, []);

  function alternarSidebar() {
    setSidebarColapsado((actual) => {
      const nuevo = !actual;
      try {
        localStorage.setItem(CLAVE_SIDEBAR_COLAPSADO, nuevo ? "1" : "0");
      } catch {
        // Igual que arriba: si no hay localStorage, solo no se recuerda la próxima vez.
      }
      return nuevo;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      <SidebarNav
        roles={roles}
        abierto={menuAbierto}
        onNavegar={() => setMenuAbierto(false)}
        colapsado={sidebarColapsado}
        onColapsar={alternarSidebar}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          usuario={usuario}
          onAbrirMenu={() => setMenuAbierto(true)}
          sidebarColapsado={sidebarColapsado}
          onMostrarSidebar={alternarSidebar}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
