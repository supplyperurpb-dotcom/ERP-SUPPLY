import { z } from "zod";

export const almacenSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio").max(30),
  nombre: z.string().min(1, "El nombre es obligatorio").max(150),
  tipo: z.enum(["INSUMOS", "AGROQUIMICOS", "MATERIAL_EMPAQUE", "CAMARA_FRIO", "OTRO"], {
    required_error: "Selecciona el tipo",
  }),
  ubicacion: z.string().max(200).optional().or(z.literal("")),
  activo: z.coerce.boolean().default(true),
});

export type AlmacenInput = z.infer<typeof almacenSchema>;

const itemIngresoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  lote: z.string().max(60).optional().or(z.literal("")),
});

export const ingresoAlmacenSchema = z.object({
  fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
  ocNumero: z.string().max(60).optional().or(z.literal("")),
  guiaRemision: z.string().max(60).optional().or(z.literal("")),
  proveedorId: z.string().optional().or(z.literal("")),
  almacenId: z.string().min(1, "Selecciona el almacén"),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemIngresoSchema).min(1, "Agrega al menos un producto"),
});

export type IngresoAlmacenInput = z.infer<typeof ingresoAlmacenSchema>;

const itemTrasladoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
});

export const trasladoAlmacenSchema = z
  .object({
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    almacenOrigenId: z.string().min(1, "Selecciona el almacén de origen"),
    almacenDestinoId: z.string().min(1, "Selecciona el almacén de destino"),
    guiaRemision: z.string().max(60).optional().or(z.literal("")),
    remitente: z.string().max(150).optional().or(z.literal("")),
    observaciones: z.string().max(500).optional().or(z.literal("")),
    items: z.array(itemTrasladoSchema).min(1, "Agrega al menos un producto"),
  })
  .refine((data) => data.almacenOrigenId !== data.almacenDestinoId, {
    message: "El almacén de origen y destino no pueden ser el mismo",
    path: ["almacenDestinoId"],
  });

export type TrasladoAlmacenInput = z.infer<typeof trasladoAlmacenSchema>;

const itemConsumoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
});

export const consumoAlmacenSchema = z.object({
  fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
  almacenOrigenId: z.string().min(1, "Selecciona el almacén"),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemConsumoSchema).min(1, "Agrega al menos un producto"),
});

export type ConsumoAlmacenInput = z.infer<typeof consumoAlmacenSchema>;
