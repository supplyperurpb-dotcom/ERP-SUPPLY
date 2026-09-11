// Catálogo fijo de módulos del fundo y las variedades sembradas en cada uno.
// La variedad disponible en el formulario de Ingresos depende del módulo
// seleccionado en esa misma línea.
export const MODULOS_ACOPIO = ["MODULO 1", "MODULO 2", "MODULO 3", "MODULO 4"] as const;

export const VARIEDADES_POR_MODULO: Record<string, string[]> = {
  "MODULO 1": ["ARANA"],
  "MODULO 2": ["RAYMI"],
  "MODULO 3": ["ROSITA"],
  "MODULO 4": ["RAYMI", "CASCADE", "BREEZE"],
};
