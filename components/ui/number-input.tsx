"use client";

import * as React from "react";
import { Input } from "./input";

// Pone comas de miles al entero (ej. "1000" -> "1,000"), sin tocar los
// decimales que el usuario ya escribió.
function formatearMiles(crudo: string): string {
  if (crudo === "" || crudo === "-") return crudo;
  const [entero, decimal] = crudo.split(".");
  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal !== undefined ? `${enteroFormateado}.${decimal}` : enteroFormateado;
}

// Cuenta cuántos caracteres "con significado" (dígitos o el punto decimal)
// hay antes de la posición del cursor — las comas no cuentan, son solo
// cosméticas. Sirve para ubicar el cursor otra vez después de reformatear.
function digitosAntesDe(texto: string, posicion: number): number {
  let n = 0;
  for (let i = 0; i < posicion && i < texto.length; i++) {
    if (/[\d.]/.test(texto[i])) n++;
  }
  return n;
}

// Inverso de digitosAntesDe: en `texto` ya formateado, encuentra la
// posición justo después del n-ésimo carácter con significado.
function posicionTrasNDigitos(texto: string, n: number): number {
  if (n <= 0) return 0;
  let contados = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/[\d.]/.test(texto[i])) {
      contados++;
      if (contados === n) return i + 1;
    }
  }
  return texto.length;
}

/**
 * Input numérico que muestra comas de miles (ej. "1,000") todo el tiempo,
 * incluso mientras se está escribiendo — reubica el cursor a mano después
 * de cada tecla para que no salte de lugar al insertarse una coma. El
 * valor que se recibe/entrega por `value`/`onChange` siempre es el número
 * "crudo" (sin comas), listo para Number(valor). Solo deja escribir
 * dígitos y un punto decimal (pegar texto con comas también se limpia solo).
 */
export const NumberInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    value: string;
    onChange: (valor: string) => void;
  }
>(({ value, onChange, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);
  const cursorPendiente = React.useRef<number | null>(null);

  const displayValue = formatearMiles(value);

  React.useLayoutEffect(() => {
    if (cursorPendiente.current !== null && innerRef.current) {
      innerRef.current.setSelectionRange(cursorPendiente.current, cursorPendiente.current);
      cursorPendiente.current = null;
    }
  }, [displayValue]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const textoEscrito = input.value;
    const posicionCursor = input.selectionStart ?? textoEscrito.length;
    const nDigitosAntes = digitosAntesDe(textoEscrito, posicionCursor);

    const limpio = textoEscrito.replace(/,/g, "");
    if (!(limpio === "" || /^\d*\.?\d*$/.test(limpio))) return;

    cursorPendiente.current = posicionTrasNDigitos(formatearMiles(limpio), nDigitosAntes);
    onChange(limpio);
  }

  return (
    <Input {...props} ref={innerRef} type="text" inputMode="decimal" value={displayValue} onChange={handleChange} />
  );
});
NumberInput.displayName = "NumberInput";
