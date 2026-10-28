"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Cada botón de "Nueva orden" (Servicio/Compra/Directa) pide primero el
// tipo — Abierta (con plazo de vigencia) o Estándar — antes de ir al
// formulario, ver TipoOrdenCompra en el schema y PREFIJO_ORDEN en
// lib/constants/compras.ts.
export function NuevaOrdenDropdown({
  etiqueta,
  baseHref,
  variant = "outline",
}: {
  etiqueta: string;
  baseHref: string;
  variant?: "outline" | "default";
}) {
  const separador = baseHref.includes("?") ? "&" : "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant}>
          <Plus className="mr-2 h-4 w-4" />
          {etiqueta}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`${baseHref}${separador}tipo=ABIERTA`}>{etiqueta} Abierta</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${baseHref}${separador}tipo=ESTANDAR`}>{etiqueta} Estándar</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
