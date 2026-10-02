import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;

export const crearUsuarioSchema = z.object({
  nombres: z.string().min(1, "Los nombres son obligatorios"),
  apellidos: z.string().min(1, "Los apellidos son obligatorios"),
  email: z.string().email("Correo inválido"),
  telefono: z.string().optional().or(z.literal("")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  tipoRol: z.enum(["REGULAR", "APROBADOR"], { required_error: "Selecciona el rol" }),
  // Área del usuario: acota lo que ve en Solicitudes de pedido y Órdenes de
  // compra/servicio sea o no aprobador; si además es aprobador, es también
  // la que queda habilitado a aprobar/rechazar.
  area: z.enum(AREAS, { required_error: "Selecciona el área del usuario" }),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
