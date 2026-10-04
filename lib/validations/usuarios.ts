import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;
// Roles especiales asignables al crear un usuario (GERENTE_RRHH no entra
// aquí: se asigna aparte, junto con el aprobador de área RRHH, en
// /logistica/solicitudes-pedido/aprobadores).
const ROLES_ESPECIALES_EN_ALTA = ["GERENTE_SUPPLY", "DISTRICT_CONTROLLER", "GERENTE_GENERAL"] as const;

export const crearUsuarioSchema = z
  .object({
    nombres: z.string().min(1, "Los nombres son obligatorios"),
    apellidos: z.string().min(1, "Los apellidos son obligatorios"),
    email: z.string().email("Correo inválido"),
    telefono: z.string().optional().or(z.literal("")),
    // Cargo/puesto (p. ej. "Gerente de Producción"). Se muestra en el PDF de
    // Solped/OC/OS cuando este usuario la aprueba.
    cargo: z.string().optional().or(z.literal("")),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    tipoRol: z.enum(["REGULAR", "APROBADOR", "APROBADOR_GENERAL"], { required_error: "Selecciona el rol" }),
    // Área del usuario: acota lo que ve en Solicitudes de pedido y Órdenes de
    // compra/servicio sea o no aprobador; si además es aprobador de área, es
    // también la que queda habilitado a aprobar/rechazar.
    area: z.enum(AREAS, { required_error: "Selecciona el área del usuario" }),
    // Solo si tipoRol = APROBADOR_GENERAL: qué rol especial ocupa (Gerente
    // de Supply, District Controller o Gerente General), usado para las
    // firmas de OC/OS por monto.
    rolEspecial: z.enum(ROLES_ESPECIALES_EN_ALTA).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoRol === "APROBADOR_GENERAL" && !data.rolEspecial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona qué rol especial ocupa",
        path: ["rolEspecial"],
      });
    }
  });

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
