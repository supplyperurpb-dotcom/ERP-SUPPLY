// Prefijo de 2 letras para una subfamilia que no trae uno propio (campo
// Subfamilia.prefijo = NULL en el catálogo editable de Logística > Listas
// > Categorías) — las 2 primeras letras del nombre, en mayúscula.
export function prefijoDeNombre(nombre: string): string {
  return nombre
    .trim()
    .replace(/[^\p{L}]/gu, "")
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, "X");
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

// No es un campo aparte en el modelo Sku: para un SKU de categoría
// "Agroquímicos, Fertilizantes y Ósmosis", el tipo está codificado en el
// prefijo de su código (ver TIPOS_AGROQUIMICO) — se usa p. ej. para la
// restricción por Área en Solped (ver skuPermitidoParaAreaSolped en
// lib/constants/compras.ts).
export function tipoAgroquimicoDeCodigo(codigo: string): TipoAgroquimicoCodigo | null {
  const c = codigo.startsWith("NV") ? codigo.slice(2) : codigo;
  const encontrado = TIPOS_AGROQUIMICO.find((t) => c.startsWith(t.prefijo));
  return encontrado?.valor ?? null;
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
//     subfamilia Combustibles -> Combustible, subfamilia Embalaje (ver
//     SUBFAMILIA_MATERIALES_EMPAQUE_SKU) -> Empaques
// null = sin restricción (Servicios).
// ---------------------------------------------------------------------
export const ETIQUETA_CATEGORIA_ALMACEN: Record<string, string> = {
  PESTICIDAS: "Pesticidas",
  FERTILIZANTES: "Fertilizantes",
  COMBUSTIBLE: "Combustible",
  SUMINISTROS: "Suministros",
  EMPAQUES: "Empaques",
};

// Prefijo del código de cada almacén según su categoría (pedido explícito
// del usuario, 2026-11-12) — ver siguienteNumero en crearAlmacenAction:
// cada categoría lleva su propio correlativo (APES1, APES2... AEMP1,
// AEMP2...), ya no un correlativo único "ALM-0001" compartido por todos.
export const PREFIJO_CODIGO_ALMACEN_POR_CATEGORIA: Record<string, string> = {
  PESTICIDAS: "APES",
  FERTILIZANTES: "AFER",
  COMBUSTIBLE: "ACOM",
  SUMINISTROS: "ASUM",
  EMPAQUES: "AEMP",
};

// Subfamilia de Suministros que agrupa los materiales de empaque — no es
// una categoría de SKU aparte (ver Logística > Listas > Categorías, familia
// Suministros).
export const SUBFAMILIA_MATERIALES_EMPAQUE_SKU = "Embalaje";

function esFiltroOCartuchoOsmosis(descripcion: string): boolean {
  return /FILTRO|CARTUCHO/i.test(descripcion);
}

export function categoriaAlmacenExigidaPorSku(sku: { codigo: string; descripcion: string; subfamilia: string }): string | null {
  const codigo = sku.codigo.startsWith("NV") ? sku.codigo.slice(2) : sku.codigo;
  if (codigo.startsWith("AG")) return "PESTICIDAS";
  if (codigo.startsWith("FE")) return "FERTILIZANTES";
  if (codigo.startsWith("OS")) return esFiltroOCartuchoOsmosis(sku.descripcion) ? "SUMINISTROS" : "PESTICIDAS";
  if (codigo.startsWith("SU")) {
    if (sku.subfamilia === "Combustibles") return "COMBUSTIBLE";
    if (sku.subfamilia === SUBFAMILIA_MATERIALES_EMPAQUE_SKU) return "EMPAQUES";
    return "SUMINISTROS";
  }
  return null;
}
