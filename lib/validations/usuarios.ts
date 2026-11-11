import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;
// Roles especiales asignables al crear un usuario (GERENTE_RRHH no entra
// aquí: se asigna aparte, junto con el aprobador de área RRHH, en
// /logistica/solicitudes-pedido/aprobadores).
const ROLES_ESPECIALES_EN_ALTA = ["GERENTE_SUPPLY", "DISTRICT_CONTROLLER", "GERENTE_GENERAL"] as const;
// DNI peruano: 8 dígitos. Es el identificador con el que el usuario
// inicia sesión (ver loginAction) — obligatorio al crear un usuario
// nuevo; al editar uno existente es opcional (ver editarUsuarioSchema).
const DNI_REGEX = /^\d{8}$/;

export const crearUsuarioSchema = z
  .object({
    nombres: z.string().min(1, "Los nombres son obligatorios"),
    apellidos: z.string().min(1, "Los apellidos son obligatorios"),
    email: z.string().email("Correo inválido"),
    dni: z.string().regex(DNI_REGEX, "El DNI debe tener 8 dígitos"),
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
    // Hrefs exactos del sidebar (ver lib/nav-config.ts) a los que este
    // usuario tendrá acceso — ver UsuarioAccesoItem. Determina tanto el
    // acceso fino por submódulo como, indirectamente, qué roles de módulo
    // (ACOPIO/LOGISTICA_COMPRAS/COMEX) se le asignan (ver crearUsuarioAction).
    accesoHrefs: z.array(z.string()).min(1, "Selecciona al menos un módulo/submódulo al que tendrá acceso"),
    // Único permiso habilitado para "cerrar posición" (Solped y OC/OS) y
    // para crear/editar Órdenes de compra y servicio — ver esComprador en
    // lib/compras.ts. Independiente de accesoHrefs: la casilla de acceso
    // controla si VE el submódulo, esta controla si puede modificarlo.
    esComprador: z.boolean(),
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

export const editarUsuarioSchema = z
  .object({
    nombres: z.string().min(1, "Los nombres son obligatorios"),
    apellidos: z.string().min(1, "Los apellidos son obligatorios"),
    email: z.string().email("Correo inválido"),
    // A diferencia de crearUsuarioSchema, acá NO es obligatorio: muchos
    // usuarios ya existían antes de este campo y un admin debe poder
    // guardar otros cambios (como resetearles la contraseña) sin que se
    // le exija completarles el DNI en el mismo guardado.
    dni: z.string().regex(DNI_REGEX, "El DNI debe tener 8 dígitos").optional().or(z.literal("")),
    telefono: z.string().optional().or(z.literal("")),
    cargo: z.string().optional().or(z.literal("")),
    // Vacío = no cambiar la contraseña actual.
    nuevaPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional().or(z.literal("")),
    tipoRol: z.enum(["REGULAR", "APROBADOR", "APROBADOR_GENERAL"], { required_error: "Selecciona el rol" }),
    area: z.enum(AREAS, { required_error: "Selecciona el área del usuario" }),
    rolEspecial: z.enum(ROLES_ESPECIALES_EN_ALTA).optional(),
    // Sin mínimo (a diferencia de crearUsuarioSchema): un ADMIN ve todos los
    // módulos sin importar esto, y un admin puede querer dejar a alguien sin
    // ningún acceso temporalmente sin tener que desactivar la cuenta.
    accesoHrefs: z.array(z.string()),
    activo: z.boolean(),
    // Ver comentario en crearUsuarioSchema.
    esComprador: z.boolean(),
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

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
