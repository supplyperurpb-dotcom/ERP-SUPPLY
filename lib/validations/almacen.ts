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

// Ejecución de una Solicitud de Traslado ya existente (ver
// lib/validations/solicitud-traslado.ts): el almacén origen y destino ya
// quedaron fijos en la solicitud, así que aquí no se piden — se vuelven a
// leer del lado del servidor (nunca se confía en lo que mande el cliente),
// igual que ingresoAlmacenSchema no pide proveedor porque sale de la OC.
const itemTrasladoDesdeSolicitudSchema = z.object({
  solicitudTrasladoItemId: z.string().min(1, "Falta el origen de esta línea"),
  skuId: z.string().min(1),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
});

export const trasladoDesdeSolicitudSchema = z.object({
  solicitudTrasladoId: z.string().min(1, "Selecciona una solicitud de traslado"),
  fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
  moneda: z.enum(["PEN", "USD"]).default("PEN"),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemTrasladoDesdeSolicitudSchema).min(1, "Selecciona al menos un ítem pendiente"),
  ...datosTransporte,
});

export type TrasladoDesdeSolicitudInput = z.infer<typeof trasladoDesdeSolicitudSchema>;

const itemConsumoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  // Obligatorios solo en almacenes de categoría AGROQUIMICOS_FERTILIZANTES
  // (lo exige el servidor, ver crearConsumoAlmacenAction) — igual que en el
  // ingreso, acá quedan opcionales porque en los demás almacenes no aplican.
  lote: z.string().max(60).optional().or(z.literal("")),
  fechaProduccion: z.coerce.date().optional(),
  fechaVencimiento: z.coerce.date().optional(),
});

export const consumoAlmacenSchema = z.object({
  fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
  horaRetiro: z.string().min(1, "La hora es obligatoria"),
  almacenOrigenId: z.string().min(1, "Selecciona el almacén"),
  // Seleccionado del catálogo RetiradorAutorizado (ver
  // lib/validations/retirador-autorizado.ts) — ya no es texto libre, el
  // combobox del formulario solo ofrece retiradores con permiso en el
  // almacén elegido.
  retiradoPor: z.string().trim().min(1, "Selecciona quién retira el material").max(150),
  retiradoPorDni: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "El DNI de quien retira es obligatorio"),
  // Rutas en Supabase Storage de la firma (PNG, capturada en un <canvas>) y
  // de la foto de evidencia del despacho — ver lib/storage.ts. Ambas
  // obligatorias: sin sustento no se puede registrar el consumo.
  firmaArchivo: z.string().min(1, "Captura la firma de quien retira el material"),
  fotoEvidenciaArchivo: z.string().min(1, "Adjunta una foto de evidencia del despacho"),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemConsumoSchema).min(1, "Agrega al menos un producto"),
});

export type ConsumoAlmacenInput = z.infer<typeof consumoAlmacenSchema>;
