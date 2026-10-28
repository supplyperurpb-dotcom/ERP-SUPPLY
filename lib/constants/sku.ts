// Subfamilias de "Suministros". Cada una tiene una abreviatura de 2 letras
// que sí entra en el código — ver PREFIJO_SUBFAMILIA_SUMINISTRO más abajo.
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

// Abreviatura de 2 letras de cada subfamilia de Suministros: define el
// código junto con "SU" (p. ej. SURI0001 = Suministro + Riego). Catálogo
// heredado del Excel "Creación de Códigos Suministros" (pestaña
// NOMENCLATURA) que compartió el usuario. Si se usa una subfamilia nueva
// que no está en esta lista, prefijoSubfamiliaSuministro() cae a las 2
// primeras letras en mayúscula.
export const PREFIJO_SUBFAMILIA_SUMINISTRO: Record<string, string> = {
  Abarrotes: "AB",
  Activo: "AC",
  Apicultura: "AP",
  Combustibles: "CO",
  Electricidad: "EL",
  Embalaje: "EM",
  EPP: "EP",
  Farmacia: "FA",
  Ferreteria: "FE",
  Formateria: "FO",
  "Gases Comprimidos": "GC",
  Gasfiteria: "GA",
  Herramientas: "HE",
  "Instrumentos de Laboratorio": "IN",
  "Letreros y Banners": "LE",
  Limpieza: "LI",
  Lubricantes: "LU",
  "Materiales de Campo": "MA",
  "Materiales de construccion": "MC",
  Merchandising: "ME",
  "Muebles y enseres": "MU",
  Plaguicidas: "PL",
  Repuestos: "RE",
  Riego: "RI",
  TI: "TI",
  "Utiles de oficina": "UT",
  Varios: "VA",
  Refrigeración: "RF",
};

export function prefijoSubfamiliaSuministro(subfamilia: string): string {
  const normalizada = subfamilia.trim();
  const conocida = Object.entries(PREFIJO_SUBFAMILIA_SUMINISTRO).find(
    ([nombre]) => nombre.toLowerCase() === normalizada.toLowerCase()
  );
  if (conocida) return conocida[1];
  return normalizada.replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase().padEnd(2, "X");
}

// Tipo de Agroquímico/Fertilizante/Ósmosis: define el prefijo de 2 letras
// del código (AG/FE/OS + correlativo de 6 dígitos — no depende de la
// subfamilia).
export const TIPOS_AGROQUIMICO = [
  { valor: "AGROQUIMICO", nombre: "Agroquímico", prefijo: "AG" },
  { valor: "FERTILIZANTE", nombre: "Fertilizante", prefijo: "FE" },
  { valor: "OSMOSIS", nombre: "Ósmosis", prefijo: "OS" },
] as const;

export type TipoAgroquimicoCodigo = (typeof TIPOS_AGROQUIMICO)[number]["valor"];

// Lista abierta (se irán agregando más subfamilias con el tiempo). Cada una
// tiene una abreviatura de 2 letras que sí entra en el código — ver
// PREFIJO_SUBFAMILIA_AGROQUIMICO más abajo.
export const SUBFAMILIAS_AGROQUIMICO = [
  "Coadyuvante",
  "Fitorregulador",
  "Foliar",
  "Fungicida",
  "Herbicida",
  "Insecticida",
  "Base",
  "Bioestimulante",
  "Limpieza",
  "Suministro",
] as const;

// Abreviatura de 2 letras de cada subfamilia: define el código junto con el
// tipo (AG/FE/OS) — ver crearSkuAgroquimicoAction. Catálogo heredado del
// cuadro de SKU que compartió el usuario (p. ej. AGFO = Agroquímico +
// Foliar, FEBE = Fertilizante + Bioestimulante). Si se usa una subfamilia
// nueva que no está en esta lista, prefijoSubfamilia() cae a las 2 primeras
// letras en mayúscula.
export const PREFIJO_SUBFAMILIA_AGROQUIMICO: Record<string, string> = {
  Coadyuvante: "CO",
  Fitorregulador: "FI",
  Foliar: "FO",
  Fungicida: "FU",
  Herbicida: "HE",
  Insecticida: "IN",
  Base: "BA",
  Bioestimulante: "BE",
  Limpieza: "LI",
  Suministro: "SU",
};

export function prefijoSubfamilia(subfamilia: string): string {
  const normalizada = subfamilia.trim();
  const conocida = Object.entries(PREFIJO_SUBFAMILIA_AGROQUIMICO).find(
    ([nombre]) => nombre.toLowerCase() === normalizada.toLowerCase()
  );
  if (conocida) return conocida[1];
  return normalizada.replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase().padEnd(2, "X");
}

// Clasificación: orgánico o convencional.
export const CLASIFICACIONES_AGROQUIMICO = ["Orgánico", "Convencional"] as const;

// Unidades de medida permitidas para Agroquímicos, Fertilizantes y Ósmosis
// (subconjunto del catálogo SUNAT compartido en lib/validations/sku.ts).
export const UNIDADES_MEDIDA_AGROQUIMICO = [
  { codigo: "LT", nombre: "Litro" },
  { codigo: "KG", nombre: "Kilogramo" },
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

// ---------------------------------------------------------------------
// A qué categoría de almacén general (AlmacenCategoriaGeneral) queda
// restringido cada código, según su tipo — se usa al ingresar, trasladar o
// consumir (ver validarOrigen/validarCategoriaExclusivaSiAplica en
// lib/actions/ingreso-almacen-actions.ts, traslado-almacen-actions.ts y
// consumo-almacen-actions.ts) para impedir que un código entre, salga o se
// mueva hacia un almacén que no le corresponde:
//   - Agroquímicos (AG/NVAG)                      -> Pesticidas
//   - Fertilizantes (FE/NVFE)                      -> Fertilizantes
//   - Ósmosis (OS/NVOS)                            -> Pesticidas, salvo que
//     sea un filtro o cartucho (no tienen subfamilia propia, se
//     reconocen por la descripción) -> esos van a Suministros
//   - Suministros (SU/NVSU)                        -> Suministros, salvo
//     subfamilia Combustibles -> esos van a Combustible
// null = sin restricción (Servicios).
// ---------------------------------------------------------------------
export const ETIQUETA_CATEGORIA_ALMACEN: Record<string, string> = {
  PESTICIDAS: "Pesticidas",
  FERTILIZANTES: "Fertilizantes",
  COMBUSTIBLE: "Combustible",
  SUMINISTROS: "Suministros",
  EMPAQUES: "Empaques",
};

function esFiltroOCartuchoOsmosis(descripcion: string): boolean {
  return /FILTRO|CARTUCHO/i.test(descripcion);
}

export function categoriaAlmacenExigidaPorSku(sku: { codigo: string; descripcion: string; subfamilia: string }): string | null {
  const codigo = sku.codigo.startsWith("NV") ? sku.codigo.slice(2) : sku.codigo;
  if (codigo.startsWith("AG")) return "PESTICIDAS";
  if (codigo.startsWith("FE")) return "FERTILIZANTES";
  if (codigo.startsWith("OS")) return esFiltroOCartuchoOsmosis(sku.descripcion) ? "SUMINISTROS" : "PESTICIDAS";
  if (codigo.startsWith("SU")) return sku.subfamilia === "Combustibles" ? "COMBUSTIBLE" : "SUMINISTROS";
  return null;
}
