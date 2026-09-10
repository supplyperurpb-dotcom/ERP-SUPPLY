"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GRUPOS, NAV_INICIO, type NavGrupo } from "@/lib/nav-config";

export function SidebarNav({ gruposVisibles }: { gruposVisibles: NavGrupo[] }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Sprout className="h-6 w-6 text-primary" />
        <span className="text-sm font-semibold leading-tight">
          Sistema Arándanos
          <br />
          <span className="text-xs font-normal text-muted-foreground">Ica, Perú</span>
        </span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <NavLink item={NAV_INICIO} pathname={pathname} />

        {gruposVisibles.map((grupo) => (
          <div key={grupo.modulo}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
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
}: {
  item: NavGrupo["items"][number];
  pathname: string;
}) {
  const activo = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icono = item.icono;

  return (
    <Link
      href={item.href}
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
