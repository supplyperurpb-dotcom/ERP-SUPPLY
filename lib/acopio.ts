// Variedad de un Pallet normal (Exportable) — sus líneas (IngresoFrutaPallet)
// son normalmente todas de la misma variedad, pero se unen con " / " por si
// alguna vez no lo son, en vez de mostrar solo la primera y ocultar el resto.
export function variedadDePallet(pallet: { lineas: { variedad: string }[] }): string {
  const variedades = [...new Set(pallet.lineas.map((l) => l.variedad))];
  return variedades.join(" / ") || "—";
}

// Variedad de un PalletIndustrial: sus líneas vienen de `lineasFruta`
// (Descarte Campo) o de `lineas` (Descarte Planta), nunca de ambas a la vez
// (ver el comentario de PalletIndustrial.origen en el schema).
export function variedadDePalletIndustrial(pallet: {
  lineas: { variedad: string }[];
  lineasFruta: { variedad: string }[];
}): string {
  const todas = [...pallet.lineasFruta, ...pallet.lineas];
  const variedades = [...new Set(todas.map((l) => l.variedad))];
  return variedades.join(" / ") || "—";
}

// Descripción de cada línea del Packing List Acopio (pedido explícito del
// usuario, 2026-11-14): "<bandejas> BANDEJAS CON ARANDANO VARIEDAD
// <variedad> / <N° de tarja>".
export function descripcionPackingList(cantidadBandejas: number, variedad: string, tarjaNumero: string): string {
  return `${cantidadBandejas} BANDEJAS CON ARANDANO VARIEDAD ${variedad} / ${tarjaNumero}`;
}
