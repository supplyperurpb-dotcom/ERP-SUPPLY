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

export const FORMATOS_LINEA_PESAJE = ["Sweetest Batch", "Pinta", "Sweet & Crunchy"] as const;

export const TIPOS_PRODUCTO_LINEA_PESAJE = ["Exportable", "Descarte Campo"] as const;
