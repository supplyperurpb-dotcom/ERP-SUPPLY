"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ConfirmFn = (mensaje: string) => Promise<boolean>;
type PromptFn = (mensaje: string, valorInicial?: string) => Promise<string | null>;

type Solicitud = { tipo: "confirm"; mensaje: string } | { tipo: "prompt"; mensaje: string; valorInicial: string };

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);
const PromptDialogContext = createContext<PromptFn | null>(null);

// Reemplaza confirm()/prompt() nativos del navegador (que siempre
// anteponen el dominio, p. ej. "erp-supply-azure.vercel.app dice" — texto
// que ninguna web puede cambiar) por una ventana propia de la app con el
// título "Notificación". Se monta una sola vez en el layout del
// dashboard; cualquier componente la usa con useConfirm()/usePrompt() de
// más abajo.
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [valor, setValor] = useState("");
  const resolverRef = useRef<((valor: boolean | string | null) => void) | null>(null);

  const confirmar = useCallback<ConfirmFn>((mensaje) => {
    setSolicitud({ tipo: "confirm", mensaje });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve as (valor: boolean | string | null) => void;
    });
  }, []);

  const pedir = useCallback<PromptFn>((mensaje, valorInicial = "") => {
    setSolicitud({ tipo: "prompt", mensaje, valorInicial });
    setValor(valorInicial);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve as (valor: boolean | string | null) => void;
    });
  }, []);

  function cerrar(resultado: boolean | string | null) {
    resolverRef.current?.(resultado);
    resolverRef.current = null;
    setSolicitud(null);
    setValor("");
  }

  function aceptar() {
    if (solicitud?.tipo === "prompt") cerrar(valor);
    else cerrar(true);
  }

  function cancelar() {
    if (solicitud?.tipo === "prompt") cerrar(null);
    else cerrar(false);
  }

  return (
    <ConfirmDialogContext.Provider value={confirmar}>
      <PromptDialogContext.Provider value={pedir}>
        {children}
        <Dialog
          open={solicitud !== null}
          onOpenChange={(open) => {
            if (!open) cancelar();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notificación</DialogTitle>
            </DialogHeader>
            <p className="text-sm">{solicitud?.mensaje}</p>
            {solicitud?.tipo === "prompt" && (
              <Input
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") aceptar();
                }}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={cancelar}>
                Cancelar
              </Button>
              <Button onClick={aceptar}>Aceptar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PromptDialogContext.Provider>
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

// Reemplazo async de window.prompt(mensaje): await usePrompt()(mensaje)
// devuelve el texto ingresado, o null si se canceló — igual que prompt().
export function usePrompt(): PromptFn {
  const ctx = useContext(PromptDialogContext);
  if (!ctx) throw new Error("usePrompt debe usarse dentro de <ConfirmDialogProvider>.");
  return ctx;
}
