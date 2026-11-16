"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificacionPendiente } from "@/lib/notificaciones";

export function NotificacionesBell({ notificaciones }: { notificaciones: NotificacionPendiente[] }) {
  const hay = notificaciones.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notificaciones">
          <Bell className="h-5 w-5" />
          {hay && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
          )}
          <span className="sr-only">
            {hay ? `${notificaciones.length} notificaciones pendientes` : "Sin notificaciones pendientes"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hay ? (
          notificaciones.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.href} className="flex flex-col items-start gap-0.5 whitespace-normal py-2">
                <span className="text-sm font-medium leading-tight">{n.titulo}</span>
                <span className="text-xs text-muted-foreground">{n.descripcion}</span>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No tienes notificaciones pendientes.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
