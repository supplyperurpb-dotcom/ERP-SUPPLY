// Valorización de un PriceRecord contra las cantidades reales disponibles
// para ese PO/embarque — SIEMPRE usa la cantidad de la unidad que declara
// el propio precio (kg si USD_KG, cajas si USD_CAJA), nunca mezcla una
// con otra. Si no hay esa cantidad disponible (ej. un precio por caja
// para un PO que solo tiene datos de Facturación, que no trae cajas),
// devuelve null en vez de inventar un total.
export function valorizar(
  unidad: "USD_KG" | "USD_CAJA",
  precioUnitario: number,
  cantidades: { totalKg: number | null; totalCajas: number | null }
): { cantidad: number; total: number } | null {
  const cantidad = unidad === "USD_KG" ? cantidades.totalKg : cantidades.totalCajas;
  if (cantidad === null || cantidad <= 0) return null;
  return { cantidad, total: cantidad * precioUnitario };
}
