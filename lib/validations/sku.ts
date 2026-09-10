import { z } from "zod";

export const skuSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio").max(30),
  descripcion: z.string().min(1, "La descripción es obligatoria").max(200),
  categoria: z.string().min(1, "La categoría es obligatoria").max(100),
  unidadMedida: z.string().min(1, "La unidad de medida es obligatoria").max(10),
  tipo: z.enum(["INSUMO", "PRODUCTO_TERMINADO"], { required_error: "Selecciona el tipo" }),
  stockMinimo: z.coerce.number().min(0).optional().nullable(),
  activo: z.coerce.boolean().default(true),
});

export type SkuInput = z.infer<typeof skuSchema>;

// Catálogo simplificado de unidades de medida SUNAT más usadas en agroexportación.
export const UNIDADES_MEDIDA = [
  { codigo: "KGM", nombre: "Kilogramo" },
  { codigo: "NIU", nombre: "Unidad" },
  { codigo: "BX", nombre: "Caja" },
  { codigo: "LTR", nombre: "Litro" },
  { codigo: "ZZ", nombre: "Otra unidad" },
] as const;
