import { z } from "zod";

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

// Catálogo simplificado de unidades de medida SUNAT más usadas en agroexportación.
export const UNIDADES_MEDIDA = [
  { codigo: "UND", nombre: "Unidad" },
  { codigo: "KGM", nombre: "Kilogramo" },
  { codigo: "BX", nombre: "Caja" },
  { codigo: "LTR", nombre: "Litro" },
  { codigo: "M", nombre: "Metro" },
  { codigo: "RLL", nombre: "Rollo" },
  { codigo: "ZZ", nombre: "Otra unidad" },
] as const;

// Categorías y subfamilias usadas hasta ahora en el catálogo de SKU (lista
// abierta: el campo es texto libre, esto solo evita reescribir el mismo
// valor a mano cada vez).
export const CATEGORIAS_SKU = ["Suministros"] as const;
export const SUBFAMILIAS_SKU = ["Materiales de Empaque"] as const;
