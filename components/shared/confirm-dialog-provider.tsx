"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmFn = (mensaje: string) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

// Reemplaza el confirm() nativo del navegador (que siempre antepone el
// dominio, p. ej. "erp-supply-azure.vercel.app dice" — texto que ninguna
// web puede cambiar) por una ventana propia de la app con el título
// "Notificación". Se monta una sola vez en el layout del dashboard;
// cualquier componente la usa con el hook useConfirm() de más abajo.
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);

  const confirmar = useCallback<ConfirmFn>((texto) => {
    setMensaje(texto);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function cerrar(valor: boolean) {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setMensaje(null);
  }

  return (
    <ConfirmDialogContext.Provider value={confirmar}>
      {children}
      <Dialog
        open={mensaje !== null}
        onOpenChange={(open) => {
          if (!open) cerrar(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificación</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{mensaje}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => cerrar(false)}>
              Cancelar
            </Button>
            <Button onClick={() => cerrar(true)}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

// Reemplazo async de window.confirm(mensaje): await useConfirm()(mensaje)
// devuelve true/false según el botón que se presione.
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmDialogProvider>.");
  return ctx;
}
