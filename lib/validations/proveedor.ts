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
    tipoDocumento: z.enum(["RUC", "DNI"], { required_error: "Selecciona el tipo de documento" }),
    numeroDocumento: z.string().min(1, "El número de documento es obligatorio").max(20),
    razonSocial: z.string().min(1, "La razón social es obligatoria").max(200),
    nombreComercial: opcional(200),
    tipo: z.enum(["INSUMOS", "FUNDO", "AMBOS"], { required_error: "Selecciona el tipo de proveedor" }),
    direccion: opcional(300),
    distrito: opcional(100),
    provincia: opcional(100),
    departamento: opcional(100),
    telefono: opcional(30),
    email: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().email("Correo inválido").max(150).optional()
    ),
    contactoNombre: opcional(150),
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
    if (data.tipoDocumento === "DNI" && !/^\d{8}$/.test(data.numeroDocumento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El DNI debe tener 8 dígitos",
        path: ["numeroDocumento"],
      });
    }
  });

export type ProveedorInput = z.infer<typeof proveedorSchema>;

export const TIPOS_PROVEEDOR = [
  { valor: "INSUMOS", nombre: "Insumos" },
  { valor: "FUNDO", nombre: "Fundo" },
  { valor: "AMBOS", nombre: "Ambos" },
] as const;
