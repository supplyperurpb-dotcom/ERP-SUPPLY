// Tasa de IGV fija (Perú). Si alguna vez cambia, este es el único lugar que
// hay que tocar.
export const IGV_TASA = 0.18;

// Misma lista de valores para el Área de una solicitud y el Centro de
// costo de cada línea (son conceptualmente distintos — el área que pide no
// siempre es el centro que paga — pero comparten el mismo catálogo).
export const AREAS_EMPRESA = [
  { valor: "PRODUCCION", nombre: "Producción" },
  { valor: "SUPPLY_CHAIN", nombre: "Supply Chain" },
  { valor: "FINANZAS", nombre: "Finanzas" },
  { valor: "GERENCIA_GENERAL", nombre: "Gerencia General" },
  { valor: "SERVICIOS_GENERALES", nombre: "Servicios Generales" },
  { valor: "RRHH", nombre: "RRHH" },
] as const;

export type AreaEmpresaCodigo = (typeof AREAS_EMPRESA)[number]["valor"];

export const TIPOS_NECESIDAD = [
  { valor: "URGENTE", nombre: "Urgente" },
  { valor: "ESTANDAR", nombre: "Estándar" },
] as const;

export type TipoNecesidadCodigo = (typeof TIPOS_NECESIDAD)[number]["valor"];
