// Catálogo fijo de módulos del fundo y las variedades sembradas en cada uno.
// La variedad disponible en el formulario de Ingresos depende del módulo
// seleccionado en esa misma línea.
export const MODULOS_ACOPIO = ["MODULO 1", "MODULO 2", "MODULO 3", "MODULO 4"] as const;

/**
 * "MODULO 1" -> "M01" — forma compacta usada en reportes (pedido explícito,
 * para que la columna de módulo ocupe menos espacio). No se usa en los
 * formularios de captura, donde el nombre completo sigue siendo más claro.
 */
export function formatModuloCompacto(modulo: string): string {
  const numero = modulo.match(/\d+/)?.[0];
  return numero ? `M${numero.padStart(2, "0")}` : modulo;
}

export const VARIEDADES_POR_MODULO: Record<string, string[]> = {
  "MODULO 1": ["ARANA"],
  "MODULO 2": ["RAYMI"],
  "MODULO 3": ["ROSITA"],
  "MODULO 4": ["RAYMI", "CASCADE", "BREEZE"],
};

// Turnos válidos por módulo + variedad (dado por el usuario como cuadro de
// referencia real del fundo). No es un rango uniforme: cada combinación
// módulo/variedad tiene su propia cantidad de turnos — por ejemplo MODULO 4
// / CASCADE y MODULO 4 / BREEZE solo llegan hasta T10, con un único turno
// cada uno, mientras que MODULO 4 / RAYMI tiene los diez.
export const TURNOS_POR_MODULO_VARIEDAD: Record<string, Record<string, string[]>> = {
  "MODULO 1": {
    ARANA: ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10"],
  },
  "MODULO 2": {
    RAYMI: ["T01", "T02", "T03", "T04", "T05", "T06"],
  },
  "MODULO 3": {
    ROSITA: ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10"],
  },
  "MODULO 4": {
    RAYMI: ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10"],
    CASCADE: ["T10"],
    BREEZE: ["T10"],
  },
};

export const FORMATOS_LINEA_PESAJE = [
  "DOTA SB",
  "DOTA PINTA",
  "DOTA 18 OZ YL",
  "DHK 4.4 OZ",
  "DOC 4.4 OZ",
  "DHK S&C",
  "DEMEA 4.4 OZ",
] as const;

export const TIPOS_PRODUCTO_LINEA_PESAJE = ["Exportable", "Descarte Campo"] as const;

// Cada fundo cosecha solo de ciertos módulos (dato real del campo, no una
// regla de la app): "Achirana M 01-02-03" cubre los módulos 1 a 3 y
// "Achirana M 04" el módulo 4 — mismos nombres de campo que Logística >
// Listas (ListaValor, tipo CAMPO). Se usa para filtrar el desplegable de
// Módulo según el Fundo elegido en Ingreso de Materia Prima. Si un fundo
// no aparece acá (uno nuevo, todavía sin configurar), se muestran todos
// los módulos.
export const MODULOS_POR_FUNDO: Record<string, string[]> = {
  "ACHIRANA M 01-02-03": ["MODULO 1", "MODULO 2", "MODULO 3"],
  "ACHIRANA M 04": ["MODULO 4"],
};
