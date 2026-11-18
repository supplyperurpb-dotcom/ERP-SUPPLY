import { z } from "zod";
import { GERENCIAS_SOLPED, AREAS_SOLPED, areasDeGerenciaSolped, type GerenciaSolpedCodigo } from "@/lib/constants/compras";

const GERENCIAS = GERENCIAS_SOLPED.map((g) => g.valor) as [GerenciaSolpedCodigo, ...GerenciaSolpedCodigo[]];
const AREAS_DETALLE = AREAS_SOLPED.map((a) => a.valor) as [string, ...string[]];

function validarAreaDetalle(data: { area: GerenciaSolpedCodigo; areaDetalle: string }, ctx: z.RefinementCtx) {
  const areasValidas = areasDeGerenciaSolped(data.area).map((a) => a.valor as string);
  if (!areasValidas.includes(data.areaDetalle)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El área elegida no corresponde a la gerencia elegida",
      path: ["areaDetalle"],
    });
  }
}

export const retiradorAutorizadoSchema = z
  .object({
    nombres: z.string().trim().min(1, "El nombre es obligatorio").max(100),
    apellidoPaterno: z.string().trim().min(1, "El apellido paterno es obligatorio").max(100),
    apellidoMaterno: z.string().trim().max(100).optional(),
    dni: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
    // Gerencia (ver GERENCIAS_SOLPED en lib/constants/compras.ts).
    area: z.enum(GERENCIAS, { required_error: "Selecciona la gerencia" }),
    // Área puntual (nivel 2) dentro de esa Gerencia — mismo organigrama que
    // Usuario.areaDetalle (ver AREAS_SOLPED en lib/constants/compras.ts).
    areaDetalle: z.enum(AREAS_DETALLE, { required_error: "Selecciona el área" }),
    almacenesPermitidosIds: z.array(z.string()).min(1, "Selecciona al menos un almacén"),
  })
  .superRefine(validarAreaDetalle);

export type RetiradorAutorizadoInput = z.infer<typeof retiradorAutorizadoSchema>;
