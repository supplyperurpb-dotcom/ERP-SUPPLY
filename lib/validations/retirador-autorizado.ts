import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;

export const retiradorAutorizadoSchema = z.object({
  nombres: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  apellidos: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  dni: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
  area: z.enum(AREAS, { required_error: "Selecciona el área" }),
  almacenesPermitidosIds: z.array(z.string()).min(1, "Selecciona al menos un almacén"),
});

export type RetiradorAutorizadoInput = z.infer<typeof retiradorAutorizadoSchema>;
