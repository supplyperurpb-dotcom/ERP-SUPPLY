import { z } from "zod";

// Campo de texto opcional: normaliza "" (lo que llega de un <input> vacío
// en el FormData) a undefined para que Prisma guarde null en vez de "".
const opcional = (max: number) =>
  z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().max(max).optional()
  );

export const proveedorSchema = z
  .object({
    procedencia: z.enum(["NACIONAL", "EXTRANJERO"], { required_error: "Selecciona la procedencia" }),
    // Un proveedor Nacional siempre es RUC (ya no se admite DNI); Extranjero
    // usa su propio código, sin formato exigido.
    tipoDocumento: z.enum(["RUC", "EXTRANJERO"], { required_error: "Selecciona el tipo de documento" }),
    numeroDocumento: z.string().min(1, "El número de documento es obligatorio").max(20),
    razonSocial: z.string().min(1, "La razón social es obligatoria").max(200),
    nombreComercial: opcional(200),
    rubro: z.string().trim().min(1, "El rubro / actividad económica es obligatorio").max(250),
    direccion: z.string().trim().min(1, "La dirección es obligatoria").max(300),
    // Ubicación: solo uno de los dos grupos aplica según procedencia (ver
    // ProveedorFormDialog) — pais si es EXTRANJERO, departamento/provincia/
    // distrito si es NACIONAL. Ambos opcionales a nivel de validación, el
    // formulario ya solo muestra el grupo que corresponde.
    pais: opcional(100),
    distrito: opcional(100),
    provincia: opcional(100),
    departamento: opcional(100),
    // Texto libre, no se exige formato de correo único: en la práctica
    // llegan varios correos separados por ";" en un mismo campo.
    telefono: z.string().trim().min(1, "El teléfono es obligatorio").max(60),
    email: z.string().trim().min(1, "El email es obligatorio").max(200),
    contactoNombre: z.string().trim().min(1, "El nombre de contacto es obligatorio").max(150),
    // Texto libre validado contra el catálogo CONDICION_PAGO en la UI (ver
    // ProveedorFormDialog) — no es un enum fijo: pedido explícito,
    // 2026-11-27, se puede escribir una nueva condición de pago acá mismo
    // (ver crearProveedorAction/actualizarProveedorAction, que la crean en
    // el catálogo si no existe ya).
    condicionPago: z.string().trim().min(1, "Selecciona la condición de pago").max(60),
    // Banco: uno de BANCOS_PROVEEDOR, o el texto libre que se escribió al
    // elegir "Otro" (ver ProveedorFormDialog) — siempre llega como texto
    // normal, "OTRO" nunca se guarda literal.
    banco: z.string().trim().min(1, "El banco es obligatorio").max(100),
    numeroCuenta: z.string().trim().min(1, "El número de cuenta es obligatorio").max(50),
    // Código de Cuenta Interbancaria: opcional (no todos los proveedores ya
    // registrados lo tienen), pero si se escribe debe ser el formato
    // peruano (20 dígitos).
    cuentaInterbancariaCci: opcional(20),
    activo: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.tipoDocumento === "RUC" && !/^\d{11}$/.test(data.numeroDocumento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El RUC debe tener 11 dígitos",
        path: ["numeroDocumento"],
      });
    }
    if (data.cuentaInterbancariaCci && !/^\d{20}$/.test(data.cuentaInterbancariaCci)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El CCI debe tener 20 dígitos",
        path: ["cuentaInterbancariaCci"],
      });
    }
  });

export type ProveedorInput = z.infer<typeof proveedorSchema>;

export const BANCOS_PROVEEDOR = ["BCP", "INTERBANK", "SCOTIABANK", "BBVA", "BANBIF", "SANTANDER"] as const;
