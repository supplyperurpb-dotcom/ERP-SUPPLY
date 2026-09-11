import Link from "next/link";
import { Home, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROL_LABELS, type RolNombre } from "@/lib/auth/constants";
import { logoutAction } from "@/lib/actions/auth-actions";
import type { UsuarioActual } from "@/lib/auth/session";

export function Topbar({
  usuario,
  onAbrirMenu,
}: {
  usuario: UsuarioActual;
  onAbrirMenu?: () => void;
}) {
  const iniciales = `${usuario.nombres[0] ?? ""}${usuario.apellidos[0] ?? ""}`.toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onAbrirMenu}>
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" asChild title="Ir al inicio">
          <Link href="/inicio">
            <Home className="h-5 w-5" />
          </Link>
        </Button>
        <div className="hidden text-sm text-muted-foreground md:block">
          {usuario.roles.map((rol) => ROL_LABELS[rol as RolNombre]).join(", ") || "Sin rol asignado"}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar>
              <AvatarFallback>{iniciales || "US"}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {usuario.nombres} {usuario.apellidos}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{usuario.nombres} {usuario.apellidos}</span>
              <span className="text-xs font-normal text-muted-foreground">{usuario.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <button type="submit" className="w-full">
              <DropdownMenuItem asChild>
                <div className="flex cursor-pointer items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </div>
              </DropdownMenuItem>
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
