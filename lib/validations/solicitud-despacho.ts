import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;

const itemSolicitudDespachoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  centroCosto: z.string().min(1, "Selecciona el centro de costo"),
  campo: z.string().optional().or(z.literal("")),
});

export const solicitudDespachoSchema = z.object({
  area: z.enum(AREAS, { required_error: "Selecciona el área" }),
  fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemSolicitudDespachoSchema).min(1, "Agrega al menos un producto"),
});

export type SolicitudDespachoInput = z.infer<typeof solicitudDespachoSchema>;
