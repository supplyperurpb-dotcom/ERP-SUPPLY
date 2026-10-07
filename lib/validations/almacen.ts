import { z } from "zod";

const CATEGORIAS_GENERAL = ["PACKING", "AGROQUIMICOS_FERTILIZANTES", "COMBUSTIBLE", "SUMINISTROS"] as const;

// Un almacén general es donde se registran los ingresos (ver
// ingresoAlmacenSchema); un sub-almacén solo recibe por traslado desde su
// general (o de otro sub), nunca por ingreso directo.
export const almacenSchema = z
  .object({
    codigo: z.string().min(1, "El código es obligatorio").max(30),
    nombre: z.string().min(1, "El nombre es obligatorio").max(150),
    tipo: z.enum(["INSUMOS", "AGROQUIMICOS", "MATERIAL_EMPAQUE", "CAMARA_FRIO", "OTRO"], {
      required_error: "Selecciona el tipo",
    }),
    ubicacion: z.string().max(200).optional().or(z.literal("")),
    activo: z.coerce.boolean().default(true),
    esGeneral: z.coerce.boolean().default(true),
    // Obligatoria si esGeneral=true: determina si en el ingreso el
    // lote/fechas son obligatorios, opcionales o no aplican.
    categoriaGeneral: z.enum(CATEGORIAS_GENERAL).optional().or(z.literal("")),
    // Obligatorio si esGeneral=false: a qué almacén general pertenece.
    almacenPadreId: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.esGeneral && !data.categoriaGeneral) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona la categoría del almacén general",
        path: ["categoriaGeneral"],
      });
    }
    if (!data.esGeneral && !data.almacenPadreId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el almacén general al que pertenece",
        path: ["almacenPadreId"],
      });
    }
  });

export type AlmacenInput = z.infer<typeof almacenSchema>;

// Datos de transporte comunes a ingreso y traslado (consumo no los tiene:
// es una salida interna, no un movimiento con guía/transporte): guía de
// remisión, RUC y nombre del remitente, y el precio del flete (que luego se
// prorratea entre los items, ver cada action).
const datosTransporte = {
  guiaRemision: z.string().max(60).optional().or(z.literal("")),
  remitenteRuc: z.string().max(20).optional().or(z.literal("")),
  remitente: z.string().max(150).optional().or(z.literal("")),
  flete: z.coerce.number().min(0, "El flete no puede ser negativo").optional().nullable(),
};

// El ingreso ahora se arma a partir de una Orden de Compra real: cada línea
// apunta a su OrdenCompraItem (de ahí sale el sku/precio, ver
// crearIngresoAlmacenAction) y solo se captura cuánto se recibe ahora —
// nunca más que lo pendiente de esa línea — y, según la categoría del
// almacén general, el lote/fechas (obligatorios en Agroquímicos y
// Fertilizantes, opcionales en Suministros, no aplican en los demás).
const itemIngresoSchema = z.object({
  ordenCompraItemId: z.string().min(1, "Falta el origen de esta línea"),
  skuId: z.string().min(1),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  lote: z.string().max(60).optional().or(z.literal("")),
  fechaProduccion: z.coerce.date().optional(),
  fechaVencimiento: z.coerce.date().optional(),
});

export const ingresoAlmacenSchema = z.object({
  fecha: z.coerce.date({ required_error: "La fecha de recepción es obligatoria" }),
  ordenCompraId: z.string().min(1, "Selecciona una orden de compra"),
  almacenId: z.string().min(1, "Selecciona el almacén"),
  guiaRemision: z.string().max(60).optional().or(z.literal("")),
  // Ruta en Supabase Storage del archivo ya subido (foto/escaneo/PDF) de
  // la guía de remisión física — ver lib/storage.ts. Obligatorio: sin
  // sustento no se puede registrar el ingreso.
  guiaRemisionArchivo: z.string().min(1, "Adjunta la guía de remisión (foto o PDF)"),
  flete: z.coerce.number().min(0, "El flete no puede ser negativo").optional().nullable(),
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
    moneda: z.enum(["PEN", "USD"]).default("PEN"),
    observaciones: z.string().max(500).optional().or(z.literal("")),
    items: z.array(itemTrasladoSchema).min(1, "Agrega al menos un producto"),
    ...datosTransporte,
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
