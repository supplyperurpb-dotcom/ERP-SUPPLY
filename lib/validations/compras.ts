import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;

const itemSolicitudPedidoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  centroCosto: z.enum(AREAS, { required_error: "Selecciona el centro de costo" }),
  observaciones: z.string().max(300).optional().or(z.literal("")),
});

export const solicitudPedidoSchema = z.object({
  area: z.enum(AREAS, { required_error: "Selecciona el área" }),
  fecha: z.coerce.date({ required_error: "La fecha de pedido es obligatoria" }),
  fechaNecesidad: z.coerce.date({ required_error: "La fecha estimada de necesidad es obligatoria" }),
  tipoNecesidad: z.enum(["URGENTE", "ESTANDAR"], { required_error: "Selecciona el tipo de necesidad" }),
  justificacion: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemSolicitudPedidoSchema).min(1, "Agrega al menos un producto"),
});

export type SolicitudPedidoInput = z.infer<typeof solicitudPedidoSchema>;

const itemOrdenCompraSchema = z.object({
  solicitudPedidoItemId: z.string().min(1, "Falta el origen de esta línea"),
  skuId: z.string().min(1),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  gravado: z.coerce.boolean().default(true),
  centroCosto: z.enum(AREAS, { required_error: "Selecciona el centro de costo" }),
});

export const ordenCompraSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona un proveedor"),
  fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
  moneda: z.enum(["PEN", "USD"]).default("PEN"),
  items: z.array(itemOrdenCompraSchema).min(1, "Selecciona al menos un ítem pendiente"),
});

export type OrdenCompraInput = z.infer<typeof ordenCompraSchema>;

export const aprobadoresAreaSchema = z.object({
  asignaciones: z.array(
    z.object({
      area: z.enum(AREAS),
      usuarioId: z.string().min(1, "Selecciona un usuario"),
    })
  ),
});

export type AprobadoresAreaInput = z.infer<typeof aprobadoresAreaSchema>;

export const rechazarSolicitudPedidoSchema = z.object({
  comentario: z.string().max(500).optional().or(z.literal("")),
});
