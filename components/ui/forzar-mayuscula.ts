import type { ChangeEvent } from "react";

// Pedido explícito: todo lo que se escriba en el sistema (SOLPED, OC/OS,
// proveedores, SKUs, comentarios, etc.) se guarda en mayúscula, aunque se
// tipee en minúscula — se fuerza en el momento de escribir, no solo al
// guardar, para que se vea así desde el primer tecleo. Vive acá (no en
// input.tsx/textarea.tsx) porque ambos componentes lo comparten.

// Tipos de <input> que son texto libre (donde tiene sentido forzar
// mayúscula). Deliberadamente NO incluye password (rompería el login),
// email (las direcciones de correo son case-insensitive pero se ven mal y
// pueden no calzar con el email real del usuario en Supabase Auth), ni los
// tipos sin letras (number, date, file, etc.) — para esos no aplica.
const TIPOS_TEXTO_LIBRE = new Set<string | undefined>([undefined, "text", "search", "tel"]);

export function esTipoDeTextoLibre(type: string | undefined): boolean {
  return TIPOS_TEXTO_LIBRE.has(type);
}

// Sube a mayúscula el valor del input/textarea en el propio evento, en
// cuanto llega el cambio — y reubica el cursor donde estaba, porque
// reemplazar .value sin eso lo manda siempre al final (molesto al escribir
// en medio de un texto ya existente).
export function forzarMayusculaEnCambio(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const el = e.target;
  const inicio = el.selectionStart;
  const fin = el.selectionEnd;
  el.value = el.value.toUpperCase();
  if (inicio !== null) {
    try {
      el.setSelectionRange(inicio, fin ?? inicio);
    } catch {
      // Algunos tipos de input (ej. los numéricos) no soportan
      // setSelectionRange — no es el caso de los tipos de texto libre que
      // llegan hasta acá, pero por las dudas no debe romper el onChange.
    }
  }
}
