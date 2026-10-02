import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;

export const crearUsuarioSchema = z
  .object({
    nombres: z.string().min(1, "Los nombres son obligatorios"),
    apellidos: z.string().min(1, "Los apellidos son obligatorios"),
    email: z.string().email("Correo inválido"),
    telefono: z.string().optional().or(z.literal("")),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    tipoRol: z.enum(["REGULAR", "APROBADOR"], { required_error: "Selecciona el rol" }),
    areaAprobador: z.enum(AREAS).optional(),
  })
  .refine((data) => data.tipoRol !== "APROBADOR" || !!data.areaAprobador, {
    message: "Selecciona el área que este usuario aprobará",
    path: ["areaAprobador"],
  });

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
