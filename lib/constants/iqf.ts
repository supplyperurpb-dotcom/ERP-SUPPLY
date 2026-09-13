// Catálogo de Ingreso IQF (descarte de planta): a diferencia de Ingreso de
// Materia Prima, aquí la variedad no depende de un módulo (no aplica), así
// que se ofrece como lista plana con todas las variedades del fundo.
export const VARIEDADES_IQF = ["ARANA", "RAYMI", "ROSITA", "CASCADE", "BREEZE"] as const;

// Todo lo registrado en Ingreso IQF es descarte de planta: el campo existe
// en el modelo de datos (igual que en Ingreso de Materia Prima) pero su
// valor es fijo, no se ofrece para elegir en el formulario.
export const TIPO_PRODUCTO_DESCARTE_PLANTA = "Descarte Planta";
