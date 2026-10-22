import * as React from "react";
import { cn } from "@/lib/utils";
import { forzarMayusculaEnCambio, esTipoDeTextoLibre } from "./forzar-mayuscula";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  // Pedido explícito: todo lo que se escribe en el sistema se guarda en
  // mayúscula. Se aplica solo a tipos de texto libre (ver
  // esTipoDeTextoLibre) — nunca a password/email/número/fecha/etc. Un
  // campo puntual puede pedir que no se le aplique con preserveCase.
  preserveCase?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, onKeyDown, onChange, preserveCase, ...props }, ref) => {
    const esNumero = type === "number";
    const mayuscula = !preserveCase && esTipoDeTextoLibre(type);
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          // Un campo numérico solo cambia borrando y escribiendo: sin
          // flechitas de spinner, sin que la rueda del mouse o las flechas
          // del teclado lo suban o bajen por accidente.
          esNumero && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        onWheel={
          esNumero
            ? (e) => {
                e.currentTarget.blur();
                onWheel?.(e);
              }
            : onWheel
        }
        onKeyDown={
          esNumero
            ? (e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                onKeyDown?.(e);
              }
            : onKeyDown
        }
        onChange={(e) => {
          if (mayuscula) forzarMayusculaEnCambio(e);
          onChange?.(e);
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
