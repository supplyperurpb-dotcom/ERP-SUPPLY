import { tipoAgroquimicoDeCodigo, SUBFAMILIA_MATERIALES_EMPAQUE_SKU } from "@/lib/constants/sku";

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

// Gerencias seleccionables como "Área" (nivel 1) de una Solped: las mismas
// 6 de AREAS_EMPRESA más "Calidad e Inocuidad" (ver AreaEmpresa en el
// schema). Solo se usa en el selector de Solped y en sus aprobadores —
// Usuario, Devolución de almacén y Solicitud de despacho siguen usando
// AREAS_EMPRESA tal cual, no se les agregó esta gerencia.
export const GERENCIAS_SOLPED = [...AREAS_EMPRESA, { valor: "CALIDAD_E_INOCUIDAD", nombre: "Calidad e Inocuidad" }] as const;

export type GerenciaSolpedCodigo = (typeof GERENCIAS_SOLPED)[number]["valor"];

// Nivel 2 del selector de Solped: el "Área" puntual dentro de cada
// Gerencia (organigrama compartido por el usuario). Donde la Gerencia no
// se subdivide (Finanzas, Gerencia General, Servicios Generales, RRHH,
// Calidad e Inocuidad) el Área es ella misma — el formulario no muestra un
// segundo selector en ese caso (ver AREAS_DE_GERENCIA_SOLPED más abajo).
export const AREAS_SOLPED = [
  { valor: "SANIDAD", nombre: "Sanidad", gerencia: "PRODUCCION" },
  { valor: "RIEGO", nombre: "Riego", gerencia: "PRODUCCION" },
  { valor: "PRODUCCION_1", nombre: "Producción 1", gerencia: "PRODUCCION" },
  { valor: "COMPRAS", nombre: "Compras", gerencia: "SUPPLY_CHAIN" },
  { valor: "COMEX", nombre: "Comex", gerencia: "SUPPLY_CHAIN" },
  { valor: "ALMACEN", nombre: "Almacén", gerencia: "SUPPLY_CHAIN" },
  { valor: "FINANZAS", nombre: "Finanzas", gerencia: "FINANZAS" },
  { valor: "GERENCIA_GENERAL", nombre: "Gerencia General", gerencia: "GERENCIA_GENERAL" },
  { valor: "SERVICIOS_GENERALES", nombre: "Servicios Generales", gerencia: "SERVICIOS_GENERALES" },
  { valor: "RRHH", nombre: "RRHH", gerencia: "RRHH" },
  { valor: "CALIDAD_E_INOCUIDAD", nombre: "Calidad e Inocuidad", gerencia: "CALIDAD_E_INOCUIDAD" },
] as const satisfies readonly { valor: string; nombre: string; gerencia: GerenciaSolpedCodigo }[];

export type AreaSolpedCodigo = (typeof AREAS_SOLPED)[number]["valor"];

export function areasDeGerenciaSolped(gerencia: GerenciaSolpedCodigo) {
  return AREAS_SOLPED.filter((a) => a.gerencia === gerencia);
}

// Qué códigos puede elegir cada Área al crear/editar una Solped de
// categoría COMPRA (pedido explícito del usuario, 2026-11-11/2026-11-12):
// las de categoría SERVICIO no se restringen por área en ningún caso. No
// existe una categoría de SKU "Materiales de Empaque" aparte: en el
// catálogo real son los Suministros de subfamilia "Embalaje" (ver
// SUBFAMILIA_MATERIALES_EMPAQUE_SKU, en lib/constants/sku.ts). El tipo
// Agroquímico/Fertilizante/Ósmosis tampoco es un campo aparte: está en el
// prefijo del código (ver tipoAgroquimicoDeCodigo).
type ReglaSkuArea = {
  suministros: boolean;
  /** Solo importa si `suministros` es true. */
  materialesEmpaque: boolean;
  agroquimico: boolean;
  fertilizante: boolean;
  osmosis: boolean;
};

const TODO: ReglaSkuArea = { suministros: true, materialesEmpaque: true, agroquimico: true, fertilizante: true, osmosis: true };
const SOLO_SUMINISTROS_SIN_EMPAQUE: ReglaSkuArea = {
  suministros: true,
  materialesEmpaque: false,
  agroquimico: false,
  fertilizante: false,
  osmosis: false,
};
const SOLO_SUMINISTROS_CON_EMPAQUE: ReglaSkuArea = {
  suministros: true,
  materialesEmpaque: true,
  agroquimico: false,
  fertilizante: false,
  osmosis: false,
};
const SUMINISTROS_SIN_EMPAQUE_MAS_AGROQUIMICO_FERTILIZANTE: ReglaSkuArea = {
  suministros: true,
  materialesEmpaque: false,
  agroquimico: true,
  fertilizante: true,
  osmosis: false,
};

const REGLA_SKU_POR_AREA_SOLPED: Record<AreaSolpedCodigo, ReglaSkuArea> = {
  // Sanidad y Riego: Suministros (sin empaque) + Agroquímicos y
  // Fertilizantes, sin Ósmosis.
  SANIDAD: SUMINISTROS_SIN_EMPAQUE_MAS_AGROQUIMICO_FERTILIZANTE,
  RIEGO: SUMINISTROS_SIN_EMPAQUE_MAS_AGROQUIMICO_FERTILIZANTE,
  PRODUCCION_1: SOLO_SUMINISTROS_SIN_EMPAQUE,
  COMPRAS: TODO,
  COMEX: TODO,
  ALMACEN: SOLO_SUMINISTROS_SIN_EMPAQUE,
  FINANZAS: SOLO_SUMINISTROS_SIN_EMPAQUE,
  GERENCIA_GENERAL: SOLO_SUMINISTROS_SIN_EMPAQUE,
  SERVICIOS_GENERALES: SOLO_SUMINISTROS_SIN_EMPAQUE,
  RRHH: SOLO_SUMINISTROS_SIN_EMPAQUE,
  CALIDAD_E_INOCUIDAD: SOLO_SUMINISTROS_CON_EMPAQUE,
};

export function skuPermitidoParaAreaSolped(
  sku: { codigo: string; categoria: string; subfamilia: string },
  areaDetalle: AreaSolpedCodigo
): boolean {
  const regla = REGLA_SKU_POR_AREA_SOLPED[areaDetalle];
  if (sku.categoria === "Suministros") {
    if (!regla.suministros) return false;
    if (sku.subfamilia === SUBFAMILIA_MATERIALES_EMPAQUE_SKU) return regla.materialesEmpaque;
    return true;
  }
  if (sku.categoria === "Agroquímicos, Fertilizantes y Ósmosis") {
    const tipo = tipoAgroquimicoDeCodigo(sku.codigo);
    if (tipo === "AGROQUIMICO") return regla.agroquimico;
    if (tipo === "FERTILIZANTE") return regla.fertilizante;
    if (tipo === "OSMOSIS") return regla.osmosis;
    return false; // código no reconocible: por seguridad no se muestra
  }
  return true; // Servicios (u otra categoría futura): sin restricción acá
}

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

// Una orden Abierta (con plazo de vigencia) y una Estándar (sin plazo)
// llevan series de numeración separadas: NB para Abierta, FO para
// Estándar, siempre después de OC-/OS- (ver TipoOrdenCompra en el schema
// y TIPOS_ORDEN más abajo).
export const TIPOS_ORDEN = [
  { valor: "ABIERTA", nombre: "Abierta" },
  { valor: "ESTANDAR", nombre: "Estándar" },
] as const;

export type TipoOrdenCodigo = (typeof TIPOS_ORDEN)[number]["valor"];

export const PREFIJO_ORDEN: Record<CategoriaCompraCodigo, Record<TipoOrdenCodigo, string>> = {
  COMPRA: { ABIERTA: "OC-NB-", ESTANDAR: "OC-FO-" },
  SERVICIO: { ABIERTA: "OS-NB-", ESTANDAR: "OS-FO-" },
};

export const NOMBRE_SOLICITUD: Record<CategoriaCompraCodigo, string> = {
  COMPRA: "Solicitud de compra",
  SERVICIO: "Solicitud de servicio",
};

export const NOMBRE_ORDEN: Record<CategoriaCompraCodigo, string> = {
  COMPRA: "Orden de compra",
  SERVICIO: "Orden de servicio",
};

// Tipo de cambio fijo usado solo para calcular en qué tramo de aprobación
// por monto cae una OC/OS emitida en soles (ver rolesFirmaRequeridos en
// lib/compras.ts). Si cambia, este es el único lugar que hay que tocar.
export const TIPO_CAMBIO_USD_APROBACION = 3.3;

export const ROLES_APROBADOR_ESPECIAL = [
  { valor: "GERENTE_SUPPLY", nombre: "Gerente de Supply Chain" },
  { valor: "DISTRICT_CONTROLLER", nombre: "District Controller" },
  { valor: "GERENTE_GENERAL", nombre: "Gerente General" },
  { valor: "GERENTE_RRHH", nombre: "Gerente de RRHH" },
] as const;

export type RolAprobadorEspecialCodigo = (typeof ROLES_APROBADOR_ESPECIAL)[number]["valor"];

// Lista fija de condiciones de pago: la elige cada Proveedor como su
// condición por defecto (ver Proveedor.condicionPago) y se precarga —
// editable — al generar una Orden de Compra para ese proveedor. La OC
// guarda su propio valor, así que cambiar la del proveedor después no
// altera las OC ya emitidas.
// Lugar de entrega de la OC/OS: lista cerrada, ya no texto libre.
export const LUGARES_ENTREGA = [
  "Recojo en Tienda",
  "Recojo en Agencia",
  "En fundo; Achirana Blue -",
  "En fundo; San Antonio Blue -",
] as const;

export type LugarEntregaCodigo = (typeof LUGARES_ENTREGA)[number];

// Los primeros 8 valores son los originales — se mantiene su orden/posición
// para no romper los `CONDICIONES_PAGO[2]` ya usados en otros formularios
// (ver CONDICION_PAGO_POR_DEFECTO más abajo, el reemplazo recomendado). El
// resto se agregó al importar la base de proveedores real (ver
// scripts/importar-proveedores.ts): son condiciones que de verdad se usan y
// no tenían equivalente en esta lista.
export const CONDICIONES_PAGO = [
  "CREDITO 7 DIAS",
  "CREDITO 15 DIAS",
  "CREDITO 30 DIAS",
  "CREDITO 60 DIAS",
  "FACTURA NEGOCIABLE 30 DIAS",
  "FACTURA NEGOCIABLE 45 DIAS",
  "FACTURA NEGOCIABLE 60 DIAS",
  "FACTURA NEGOCIABLE 120 DIAS",
  "CONTADO",
  "CREDITO 10 DIAS",
  "CREDITO 75 DIAS",
  "CREDITO 90 DIAS",
  "FACTURA NEGOCIABLE 90 DIAS",
  "ADELANTO 20%",
  "ADELANTO 30%",
  "ADELANTO 40%",
  "ADELANTO 50%",
  "SEGUN OBSERVACION",
] as const;

export type CondicionPagoCodigo = (typeof CONDICIONES_PAGO)[number];

// Reemplazo explícito de los `CONDICIONES_PAGO[2]` usados como valor por
// defecto en los formularios — un índice mágico se habría corrido al
// agregar valores nuevos al final de la lista.
export const CONDICION_PAGO_POR_DEFECTO: CondicionPagoCodigo = "CREDITO 30 DIAS";
