import { z } from "zod";

export const tipoBandejaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(100),
  pesoTaraKg: z.coerce
    .number({ invalid_type_error: "El peso tara es obligatorio" })
    .positive("El peso tara debe ser mayor que 0"),
  activo: z.coerce.boolean().default(true),
});

export type TipoBandejaInput = z.infer<typeof tipoBandejaSchema>;

export const tipoPalletSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(100),
  pesoTaraKg: z.coerce
    .number({ invalid_type_error: "El peso tara es obligatorio" })
    .positive("El peso tara debe ser mayor que 0"),
  activo: z.coerce.boolean().default(true),
});

export type TipoPalletInput = z.infer<typeof tipoPalletSchema>;
