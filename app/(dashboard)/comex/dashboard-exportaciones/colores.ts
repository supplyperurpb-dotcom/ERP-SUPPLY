// Paleta sobria compartida por todos los gráficos del dashboard (estilo
// Power BI: tonos apagados, nada de colores "de neón"). Dos partes:
//
// 1. COLOR_SEMANTICO: colores fijos para valores que se repiten en varios
//    gráficos (TYPE y LABEL de la hoja Facturación) — pedido explícito:
//    Premium en azul marino, Convencional en amarillo (mismo tono que
//    YL), y JB/SB en dos tonos de azul marino distintos (S&C no se pidió,
//    se le asignó un tono neutro).
// 2. PALETA_SOBRIA: colores de respaldo, en orden, para cualquier otra
//    serie sin color semántico (ej. AEREO/MARITIMO, ARRIBADO/EN TRANSITO,
//    o las porciones de los gráficos de torta).

export const COLOR_SEMANTICO: Record<string, string> = {
  PREMIUM: "#1F3A5F", // azul marino
  CONVENCIONAL: "#D9B64E", // amarillo discreto, mismo tono que YL
  YL: "#D9B64E", // amarillo discreto (no escandaloso)
  SB: "#1F3A5F", // azul marino
  JB: "#4A6FA5", // azul marino, tono más claro
  "S&C": "#7A8699", // tono neutro — no se pidió un color específico para esta etiqueta
};

export const PALETA_SOBRIA = [
  "#1F3A5F", // azul marino
  "#5B7A9D", // azul acero
  "#8C97A8", // gris azulado
  "#B08D57", // bronce apagado
  "#6B8F71", // verde salvia
  "#9A6B6B", // terracota apagado
] as const;

/** Color para una serie: el semántico si existe (ej. "PREMIUM", "YL"), si no el de la paleta por índice. */
export function colorPara(etiqueta: string, indiceRespaldo: number): string {
  return COLOR_SEMANTICO[etiqueta] ?? PALETA_SOBRIA[indiceRespaldo % PALETA_SOBRIA.length];
}

// Gris claro para líneas de referencia (CartesianGrid) y ejes — más
// discreto que el gris por defecto de recharts.
export const COLOR_GRILLA = "#E5E7EB";
export const COLOR_EJE = "#6B7280";
