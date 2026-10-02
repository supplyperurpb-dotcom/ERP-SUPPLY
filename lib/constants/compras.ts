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

// Categoría de toda la cadena solicitud -> orden. No se pueden mezclar
// dentro de un mismo documento: cada categoría tiene su propia serie de
// numeración y su propio nombre de documento.
export const CATEGORIAS_COMPRA = [
  { valor: "COMPRA", nombre: "Compra" },
  { valor: "SERVICIO", nombre: "Servicio" },
] as const;

export type CategoriaCompraCodigo = (typeof CATEGORIAS_COMPRA)[number]["valor"];

export const PREFIJO_SOLICITUD: Record<CategoriaCompraCodigo, string> = {
  COMPRA: "SP-",
  SERVICIO: "SS-",
};

export const PREFIJO_ORDEN: Record<CategoriaCompraCodigo, string> = {
  COMPRA: "OC-",
  SERVICIO: "OS-",
};

export const NOMBRE_SOLICITUD: Record<CategoriaCompraCodigo, string> = {
  COMPRA: "Solicitud de compra",
  SERVICIO: "Solicitud de servicio",
};

export const NOMBRE_ORDEN: Record<CategoriaCompraCodigo, string> = {
  COMPRA: "Orden de compra",
  SERVICIO: "Orden de servicio",
};
