// Tipo de cambio FIJO Soles→Dólares (no se consulta ninguna API ni se
// ingresa a mano por documento, por pedido explícito del usuario). Si en el
// futuro se necesita que varíe, este es el único lugar que hay que tocar.
export const TIPO_CAMBIO_PEN_USD = 3.3;

export const MONEDAS = [
  { codigo: "PEN", nombre: "Soles" },
  { codigo: "USD", nombre: "Dólares" },
] as const;

export type MonedaCodigo = (typeof MONEDAS)[number]["codigo"];

// Convierte un monto de la moneda del documento a Dólares (moneda base del
// costeo de stock, ver lib/stock-almacen.ts).
export function convertirAUsd(monto: number, moneda: MonedaCodigo): number {
  return moneda === "PEN" ? monto / TIPO_CAMBIO_PEN_USD : monto;
}
