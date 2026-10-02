// Subfamilias de "Suministros" (clasificación; no entra en el código —
// ver lib/actions/sku-actions.ts, el código de Suministros es solo
// SU + correlativo).
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
// del código (AG/FE/OS + correlativo de 6 dígitos — no depende de la
// subfamilia).
export const TIPOS_AGROQUIMICO = [
  { valor: "AGROQUIMICO", nombre: "Agroquímico", prefijo: "AG" },
  { valor: "FERTILIZANTE", nombre: "Fertilizante", prefijo: "FE" },
  { valor: "OSMOSIS", nombre: "Ósmosis", prefijo: "OS" },
] as const;

export type TipoAgroquimicoCodigo = (typeof TIPOS_AGROQUIMICO)[number]["valor"];

// Lista abierta: por ahora solo existe "Bioestimulante" en el catálogo que
// compartió el usuario; se irán agregando más subfamilias con el tiempo
// (clasificación; no entra en el código).
export const SUBFAMILIAS_AGROQUIMICO = ["Bioestimulante"] as const;

// Clasificación: orgánico o convencional.
export const CLASIFICACIONES_AGROQUIMICO = ["Orgánico", "Convencional"] as const;

// Unidades de medida permitidas para Agroquímicos, Fertilizantes y Ósmosis
// (subconjunto del catálogo SUNAT compartido en lib/validations/sku.ts).
export const UNIDADES_MEDIDA_AGROQUIMICO = [
  { codigo: "LTR", nombre: "Litro" },
  { codigo: "KGM", nombre: "Kilogramo" },
  { codigo: "UND", nombre: "Unidad" },
] as const;

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
