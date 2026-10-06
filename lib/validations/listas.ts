import { z } from "zod";
import { TIPOS_LISTA, type TipoListaCodigo } from "@/lib/constants/listas";

const TIPOS = TIPOS_LISTA.map((t) => t.tipo) as [TipoListaCodigo, ...TipoListaCodigo[]];

export const crearListaValorSchema = z.object({
  tipo: z.enum(TIPOS, { required_error: "Tipo de lista inválido" }),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
});

export type CrearListaValorInput = z.infer<typeof crearListaValorSchema>;

export const renombrarListaValorSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
});

export type RenombrarListaValorInput = z.infer<typeof renombrarListaValorSchema>;
