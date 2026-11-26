import { z } from "zod";

export const familiaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  prefijo: z
    .string()
    .trim()
    .min(1, "El prefijo es obligatorio")
    .max(6)
    .transform((v) => v.toUpperCase()),
});

export type FamiliaInput = z.infer<typeof familiaSchema>;

export const subfamiliaSchema = z.object({
  familiaId: z.string().min(1, "Selecciona la familia"),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  prefijo: z
    .string()
    .trim()
    .max(6)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.toUpperCase() : undefined)),
});

export type SubfamiliaInput = z.infer<typeof subfamiliaSchema>;

export const grupoSchema = z.object({
  subfamiliaId: z.string().min(1, "Selecciona la subfamilia"),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
});

export type GrupoInput = z.infer<typeof grupoSchema>;
