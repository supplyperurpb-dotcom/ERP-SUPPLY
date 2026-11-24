"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/acopio/reporte", label: "Reporte diario" },
  { href: "/acopio/reporte/general", label: "Reporte general" },
] as const;

// Mismo look de Tabs/TabsList (components/ui/tabs.tsx) pero con <Link>, no
// Radix Tabs: Diario y General son rutas distintas (cada una con su propio
// fetch y sus propios filtros), no paneles de un mismo Tabs.Root.
export function ReporteNavTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground print:hidden">
      {PESTANAS.map((p) => {
        const activa = pathname === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
              activa ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
