import { z } from "zod";

const itemSolicitudTrasladoSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
});

export const solicitudTrasladoSchema = z
  .object({
    almacenOrigenId: z.string().min(1, "Selecciona el almacén de origen"),
    almacenDestinoId: z.string().min(1, "Selecciona el almacén de destino"),
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    observaciones: z.string().max(500).optional().or(z.literal("")),
    items: z.array(itemSolicitudTrasladoSchema).min(1, "Agrega al menos un producto"),
  })
  .refine((data) => data.almacenOrigenId !== data.almacenDestinoId, {
    message: "El almacén de origen y destino no pueden ser el mismo",
    path: ["almacenDestinoId"],
  });

export type SolicitudTrasladoInput = z.infer<typeof solicitudTrasladoSchema>;
