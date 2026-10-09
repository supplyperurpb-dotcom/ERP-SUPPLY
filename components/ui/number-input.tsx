"use client";

import * as React from "react";
import { Input } from "./input";

// Pone comas de miles al entero mientras no se está editando (p. ej.
// "1000" -> "1,000"), sin tocar los decimales que el usuario ya escribió.
function formatearMiles(crudo: string): string {
  if (crudo === "" || crudo === "-") return crudo;
  const [entero, decimal] = crudo.split(".");
  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal !== undefined ? `${enteroFormateado}.${decimal}` : enteroFormateado;
}

/**
 * Input numérico que muestra comas de miles (ej. "1,000") cuando no tiene el
 * foco, y el número sin formatear mientras se edita — así nunca hay que
 * pelear con la posición del cursor. El valor que se recibe/entrega por
 * `value`/`onChange` siempre es el número "crudo" (sin comas), listo para
 * Number(valor). Solo deja escribir dígitos y un punto decimal (y pegar
 * texto con comas, que se limpian solas).
 */
export const NumberInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    value: string;
    onChange: (valor: string) => void;
  }
>(({ value, onChange, onFocus, onBlur, ...props }, ref) => {
  const [enfocado, setEnfocado] = React.useState(false);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={enfocado ? value : formatearMiles(value)}
      onFocus={(e) => {
        setEnfocado(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setEnfocado(false);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const limpio = e.target.value.replace(/,/g, "");
        if (limpio === "" || /^\d*\.?\d*$/.test(limpio)) {
          onChange(limpio);
        }
      }}
    />
  );
});
NumberInput.displayName = "NumberInput";
