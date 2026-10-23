import { z } from "zod";
import { SUBFAMILIAS_SUMINISTROS, TIPOS_AGROQUIMICO } from "@/lib/constants/sku";

export const skuSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio").max(30),
  descripcion: z.string().min(1, "La descripción es obligatoria").max(200),
  categoria: z.string().min(1, "La categoría es obligatoria").max(100),
  subfamilia: z.string().min(1, "La subfamilia es obligatoria").max(100),
  unidadMedida: z.string().min(1, "La unidad de medida es obligatoria").max(10),
  stockMinimo: z.coerce.number().min(0).optional().nullable(),
  activo: z.coerce.boolean().default(true),
});

export type SkuInput = z.infer<typeof skuSchema>;

// Unidades de medida: el catálogo SUNAT simplificado original (UND, KGM, BX,
// LTR, M, RLL, ZZ) más todas las que aparecían en los códigos de los Excel
// de Suministros y de Agroquímicos/Fertilizantes/Ósmosis que compartió el
// usuario (p. ej. KG, LT, PAR, GLN... — variantes históricas del mismo
// origen de datos, no normalizadas, para que los SKU ya creados con esas
// unidades se puedan seguir editando).
export const UNIDADES_MEDIDA = [
  { codigo: "UND", nombre: "Unidad" },
  { codigo: "KGM", nombre: "Kilogramo" },
  { codigo: "KG", nombre: "Kilogramo" },
  { codigo: "LTR", nombre: "Litro" },
  { codigo: "LT", nombre: "Litro" },
  { codigo: "BX", nombre: "Caja" },
  { codigo: "CJ", nombre: "Caja" },
  { codigo: "CJA", nombre: "Caja" },
  { codigo: "CAJ", nombre: "Caja" },
  { codigo: "PAR", nombre: "Par" },
  { codigo: "KIT", nombre: "Kit" },
  { codigo: "GLN", nombre: "Galón" },
  { codigo: "GL", nombre: "Galón" },
  { codigo: "PQT", nombre: "Paquete" },
  { codigo: "PAQ", nombre: "Paquete" },
  { codigo: "MLL", nombre: "Millar" },
  { codigo: "M", nombre: "Metro" },
  { codigo: "MT", nombre: "Metro" },
  { codigo: "M2", nombre: "Metro cuadrado" },
  { codigo: "M3", nombre: "Metro cúbico" },
  { codigo: "RLL", nombre: "Rollo" },
  { codigo: "ROL", nombre: "Rollo" },
  { codigo: "JGO", nombre: "Juego" },
  { codigo: "CNT", nombre: "Ciento" },
  { codigo: "BALDE", nombre: "Balde" },
  { codigo: "BBL", nombre: "Barril" },
  { codigo: "SET", nombre: "Set" },
  { codigo: "TN", nombre: "Tonelada" },
  { codigo: "TON", nombre: "Tonelada" },
  { codigo: "ZZ", nombre: "Otra unidad" },
] as const;

// Categorías y subfamilias usadas hasta ahora en el catálogo de SKU (lista
// abierta: el campo es texto libre, esto solo evita reescribir el mismo
// valor a mano cada vez). Se mantiene para el formulario de edición, que
// sigue siendo genérico.
export const CATEGORIAS_SKU = ["Suministros", "Agroquímicos, Fertilizantes y Ósmosis", "Servicios"] as const;
export const SUBFAMILIAS_SKU = ["Materiales de Empaque"] as const;

// ---------------------------------------------------------------------
// Suministros: (NV si no valorado) + SU + correlativo.
// ---------------------------------------------------------------------
export const skuSuministroSchema = z.object({
  subfamilia: z.enum(SUBFAMILIAS_SUMINISTROS, { required_error: "Selecciona la subfamilia" }),
  producto: z.string().min(1, "El producto es obligatorio").max(100),
  material: z.string().max(60).optional().or(z.literal("")),
  marca: z.string().max(60).optional().or(z.literal("")),
  medida: z.string().max(60).optional().or(z.literal("")),
  destinoDescripcion: z.string().max(100).optional().or(z.literal("")),
  codigoParte: z.string().max(60).optional().or(z.literal("")),
  color: z.string().max(40).optional().or(z.literal("")),
  presentacion: z.string().max(60).optional().or(z.literal("")),
  unidadMedida: z.string().min(1, "La unidad de medida es obligatoria").max(10),
  stockMinimo: z.coerce.number().min(0).optional().nullable(),
});

export type SkuSuministroInput = z.infer<typeof skuSuministroSchema>;

// ---------------------------------------------------------------------
// Agroquímicos, Fertilizantes y Ósmosis: [AG|FE|OS] (+ NV si no valorado)
// + 2 primeras letras de la subfamilia + correlativo.
// ---------------------------------------------------------------------
const TIPOS_AGROQUIMICO_VALORES = TIPOS_AGROQUIMICO.map((t) => t.valor) as [string, ...string[]];

export const skuAgroquimicoSchema = z.object({
  tipo: z.enum(TIPOS_AGROQUIMICO_VALORES, { required_error: "Selecciona el tipo" }),
  subfamilia: z.string().min(1, "Selecciona la subfamilia").max(100),
  producto: z.string().min(1, "El producto es obligatorio").max(100),
  activo: z.string().max(300).optional().or(z.literal("")),
  clasificacion: z.string().max(60).optional().or(z.literal("")),
  unidadMedida: z.string().min(1, "La unidad de medida es obligatoria").max(10),
  stockMinimo: z.coerce.number().min(0).optional().nullable(),
});

export type SkuAgroquimicoInput = z.infer<typeof skuAgroquimicoSchema>;

// ---------------------------------------------------------------------
// Servicios: SERV + correlativo (una sola serie, no depende de subfamilia).
// El SKU solo agrupa (p. ej. "Apicultura"); el detalle de cada pedido se
// describe al crear la solicitud, no aquí — por eso no lleva comentario.
// ---------------------------------------------------------------------
export const skuServicioSchema = z.object({
  subfamilia: z.string().trim().min(1, "Escribe el nombre de la subfamilia").max(100),
  unidadMedida: z.string().min(1, "La unidad de medida es obligatoria").max(10).default("UND"),
});

export type SkuServicioInput = z.infer<typeof skuServicioSchema>;
