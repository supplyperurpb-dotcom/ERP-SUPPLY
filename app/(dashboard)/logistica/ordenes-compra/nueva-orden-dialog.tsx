"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CategoriaCompraCodigo, TipoOrdenCodigo } from "@/lib/constants/compras";

// Selector en 2 pasos para crear una orden: primero Compra o Servicio,
// luego Estándar o Abierta — recién ahí navega al formulario. basePath
// decide si termina en el flujo normal (jalando de una Solped) o en el
// directo (/nueva-directa, sin solicitud de origen).
export function NuevaOrdenDialog({
  etiqueta,
  basePath,
  variant = "outline",
}: {
  etiqueta: string;
  basePath: string;
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaCompraCodigo | null>(null);

  function cerrar() {
    setOpen(false);
    setCategoria(null);
  }

  function ir(tipoOrden: TipoOrdenCodigo) {
    if (!categoria) return;
    const href = `${basePath}?categoria=${categoria}&tipo=${tipoOrden}`;
    cerrar();
    router.push(href);
  }

  const nombreDocumento = categoria === "SERVICIO" ? "Orden de Servicio" : "Orden de Compra";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setCategoria(null);
      }}
    >
      <Button
        variant={variant}
        onClick={() => {
          setOpen(true);
          setCategoria(null);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        {etiqueta}
      </Button>
      <DialogContent className="sm:max-w-md">
        {categoria === null ? (
          <>
            <DialogHeader>
              <DialogTitle>¿Compra o Servicio?</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setCategoria("COMPRA")}>
                Compra
              </Button>
              <Button variant="outline" onClick={() => setCategoria("SERVICIO")}>
                Servicio
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCategoria(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {nombreDocumento}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => ir("ESTANDAR")}>
                {nombreDocumento} Estándar
              </Button>
              <Button variant="outline" onClick={() => ir("ABIERTA")}>
                {nombreDocumento} Abierta
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
