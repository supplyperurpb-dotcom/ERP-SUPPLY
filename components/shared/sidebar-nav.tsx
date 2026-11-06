"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  colapsado = false,
  onColapsar,
}: {
  roles: RolNombre[];
  abierto?: boolean;
  onNavegar?: () => void;
  /** Solo aplica en escritorio — en mobile el menú siempre es el overlay controlado por "abierto". */
  colapsado?: boolean;
  onColapsar?: () => void;
}) {
  const pathname = usePathname();
  const [logoError, setLogoError] = useState(false);
  const gruposVisibles = NAV_GRUPOS.filter((grupo) => tienePermiso(roles, grupo.modulo as Modulo));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform",
        abierto ? "translate-x-0" : "-translate-x-full",
        colapsado ? "md:hidden" : "md:static md:z-auto md:flex md:translate-x-0"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        {/* Chip blanco detrás del logo: el archivo (public/logo-rpb.jpg) tiene
            fondo blanco sólido, no transparente — sin este chip se vería como
            un rectángulo flotando sobre el navy. No se toca la imagen. */}
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white p-1 shadow-sm">
          {logoError ? (
            <Sprout className="h-full w-full text-primary" />
          ) : (
            <Image
              src="/logo-rpb.jpg"
              alt="Logo de ERP Supply Chain"
              fill
              sizes="40px"
              className="object-contain p-0.5"
              onError={() => setLogoError(true)}
            />
          )}
        </div>
        <span className="text-sm font-semibold leading-tight text-sidebar-foreground">
          ERP Supply Chain
          <br />
          <span className="text-xs font-normal text-sidebar-foreground/70">Ica, Perú</span>
        </span>
        {onColapsar && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto hidden shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
            onClick={onColapsar}
            title="Ocultar menú"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <NavLink item={NAV_INICIO} pathname={pathname} onNavegar={onNavegar} />

        {gruposVisibles.map((grupo) => (
          <div key={grupo.modulo}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
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
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icono className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.titulo}</span>
    </Link>
  );
}
