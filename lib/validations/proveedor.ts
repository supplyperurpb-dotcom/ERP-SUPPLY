import { z } from "zod";
import { CONDICIONES_PAGO } from "@/lib/constants/compras";

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
    tipoDocumento: z.enum(["RUC", "DNI", "EXTRANJERO"], { required_error: "Selecciona el tipo de documento" }),
    numeroDocumento: z.string().min(1, "El número de documento es obligatorio").max(20),
    razonSocial: z.string().min(1, "La razón social es obligatoria").max(200),
    nombreComercial: opcional(200),
    // Se usa para filtrar: Acopio solo ofrece FUNDO/AMBOS como proveedor de
    // fruta en "Nuevo ingreso" (ver app/(dashboard)/acopio/ingreso*/page.tsx) —
    // no quitar este campo sin revisar esos usos primero.
    tipo: z.enum(["INSUMOS", "FUNDO", "AMBOS", "TRANSPORTE", "MATERIALES_EMPAQUE", "ALMACEN"], {
      required_error: "Selecciona el tipo de proveedor",
    }),
    // Actividad económica / rubro (texto libre) — distinto de `tipo`.
    rubro: opcional(250),
    direccion: opcional(300),
    lugar: opcional(150),
    distrito: opcional(100),
    provincia: opcional(100),
    departamento: opcional(100),
    // Texto libre, no se exige formato de correo único: en la práctica
    // llegan varios correos separados por ";" en un mismo campo.
    telefono: z.string().trim().min(1, "El teléfono es obligatorio").max(60),
    email: z.string().trim().min(1, "El email es obligatorio").max(200),
    contactoNombre: z.string().trim().min(1, "El nombre de contacto es obligatorio").max(150),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
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
  { valor: "TRANSPORTE", nombre: "Transporte" },
  { valor: "MATERIALES_EMPAQUE", nombre: "Materiales de Empaque" },
  { valor: "ALMACEN", nombre: "Almacén" },
] as const;
