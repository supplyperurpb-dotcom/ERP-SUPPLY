// Subfamilias de "Suministros". El código se arma como
// SU + 2 primeras letras de la subfamilia + correlativo (ver
// lib/actions/sku-actions.ts). Dos subfamilias pueden compartir sus 2
// primeras letras (p. ej. "Gases Comprimidos" y "Gasfiteria" → GA); en ese
// caso comparten también la serie de correlativos, ya que el código final
// es lo único que debe ser único.
export const SUBFAMILIAS_SUMINISTROS = [
  "Abarrotes",
  "Activo",
  "Apicultura",
  "Combustibles",
  "Electricidad",
  "Embalaje",
  "EPP",
  "Farmacia",
  "Ferreteria",
  "Formateria",
  "Gases Comprimidos",
  "Gasfiteria",
  "Herramientas",
  "Instrumentos de Laboratorio",
  "Letreros y Banners",
  "Limpieza",
  "Lubricantes",
  "Materiales de Campo",
  "Materiales de construccion",
  "Merchandising",
  "Muebles y enseres",
  "Plaguicidas",
  "Repuestos",
  "Riego",
  "TI",
  "Utiles de oficina",
  "Varios",
  "Refrigeración",
] as const;

export type SubfamiliaSuministroCodigo = (typeof SUBFAMILIAS_SUMINISTROS)[number];

// Tipo de Agroquímico/Fertilizante/Ósmosis: define el prefijo de 2 letras
// del código (en vez del "SU" fijo de Suministros).
export const TIPOS_AGROQUIMICO = [
  { valor: "AGROQUIMICO", nombre: "Agroquímico", prefijo: "AG" },
  { valor: "FERTILIZANTE", nombre: "Fertilizante", prefijo: "FE" },
  { valor: "OSMOSIS", nombre: "Ósmosis", prefijo: "OS" },
] as const;

export type TipoAgroquimicoCodigo = (typeof TIPOS_AGROQUIMICO)[number]["valor"];

// Lista abierta: por ahora solo existe "Bioestimulante" en el catálogo que
// compartió el usuario; se irán agregando más subfamilias con el tiempo.
export const SUBFAMILIAS_AGROQUIMICO = ["Bioestimulante"] as const;

// "Bioestimulante" se abrevia "BE" (no "BI", que serían sus 2 primeras
// letras tal cual) — probablemente B de "Bio" + E de "Estimulante". Hasta
// confirmar la regla general, las subfamilias de Agroquímicos usan este
// mapa explícito en vez de dosLetras(); si una subfamilia nueva no está
// aquí, se cae de vuelta a dosLetras() como mejor intento.
export const LETRAS_SUBFAMILIA_AGROQUIMICO: Record<string, string> = {
  Bioestimulante: "BE",
};

export function letrasSubfamiliaAgroquimico(subfamilia: string): string {
  return LETRAS_SUBFAMILIA_AGROQUIMICO[subfamilia] ?? dosLetras(subfamilia);
}

// Clasificaciones adicionales vistas en el catálogo (p. ej. "ORGANICO").
export const CLASIFICACIONES_AGROQUIMICO = ["ORGANICO"] as const;

// Subfamilias de Servicios: lista abierta (sugerencias), el código de
// Servicios no depende de la subfamilia — ver crearSkuServicioAction.
export const SUBFAMILIAS_SERVICIOS = [
  "Servicios Varios",
  "Consultoría Legal",
  "Obras Civiles",
  "Obras Eléctricas",
  "Alquiler de Maquinaria",
  "Alquiler de Equipos",
  "Alquiler de Vehículos Menores",
  "Transporte de Personal",
  "Transporte de materiales",
  "Sistema de Riego",
  "Servicios Generales",
  "Alimentación",
  "Infraestructura de Campo",
  "Mantenimiento de Vehículos",
  "Seguros Locales",
  "Auditorias de Campo",
  "Auditorias Financiera",
  "Consultoría Tributaria",
  "Consultoría Contable",
  "Consultoría Campo",
  "Análisis de Laboratorio",
  "Servicios Administrativos",
  "Apicultura",
  "Calibración de materiales y equipos",
  "Seguridad Privada",
  "Servicio de maquila de fruta",
  "Fletes Marítimos",
] as const;

// Primeras 2 letras (en mayúscula) de una subfamilia, usadas en el código
// de Suministros y de Agroquímicos/Fertilizantes/Ósmosis.
export function dosLetras(texto: string): string {
  return texto.trim().slice(0, 2).toUpperCase();
}
