import { z } from "zod";

export const TIPOS_CAMION = [
  { valor: "TERMOKING", nombre: "Termoking" },
  { valor: "CAMION_KIA", nombre: "Camión Kia" },
  { valor: "CAMIONETA", nombre: "Camioneta" },
] as const;

export const camionSchema = z.object({
  placa: z
    .string()
    .trim()
    .min(1, "La placa es obligatoria")
    .max(20)
    .transform((v) => v.toUpperCase()),
  tipo: z.enum(["TERMOKING", "CAMION_KIA", "CAMIONETA"], { required_error: "Selecciona el tipo de camión" }),
});

export type CamionInput = z.infer<typeof camionSchema>;

export const conductorSchema = z.object({
  tipo: z.enum(["PROPIO", "TERCERO"], { required_error: "Selecciona el tipo" }),
  nombre: z.string().trim().min(1, "El nombre del conductor es obligatorio").max(150),
  dni: z.string().trim().min(1, "El DNI es obligatorio").max(20),
  licenciaConducir: z.string().trim().min(1, "La licencia de conducir es obligatoria").max(30),
});

export type ConductorInput = z.infer<typeof conductorSchema>;
