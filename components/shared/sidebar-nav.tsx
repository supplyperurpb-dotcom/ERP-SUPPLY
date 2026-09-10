"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GRUPOS, NAV_INICIO, type NavGrupo } from "@/lib/nav-config";
import { tienePermiso, type Modulo, type RolNombre } from "@/lib/auth/constants";

// Recibe solo los roles (datos planos, serializables) y calcula acá los
// grupos visibles. NAV_GRUPOS incluye componentes de ícono de lucide-react,
// que no se pueden pasar como prop desde un Server Component a este Client
// Component (React solo permite objetos planos a través de esa frontera).
export function SidebarNav({
  roles,
  abierto = false,
  onNavegar,
}: {
  roles: RolNombre[];
  abierto?: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const gruposVisibles = NAV_GRUPOS.filter((grupo) => tienePermiso(roles, grupo.modulo as Modulo));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r bg-card transition-transform md:static md:z-auto md:flex md:translate-x-0",
        abierto ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Sprout className="h-6 w-6 text-primary" />
        <span className="text-sm font-semibold leading-tight">
          Sistema Arándanos
          <br />
          <span className="text-xs font-normal text-muted-foreground">Ica, Perú</span>
        </span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <NavLink item={NAV_INICIO} pathname={pathname} onNavegar={onNavegar} />

        {gruposVisibles.map((grupo) => (
          <div key={grupo.modulo}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavegar={onNavegar} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function NavLink({
  item,
  pathname,
  onNavegar,
}: {
  item: NavGrupo["items"][number];
  pathname: string;
  onNavegar?: () => void;
}) {
  const activo = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icono = item.icono;

  return (
    <Link
      href={item.href}
      onClick={onNavegar}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        activo
          ? "bg-primary text-primary-foreground"
          : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icono className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.titulo}</span>
    </Link>
  );
}
