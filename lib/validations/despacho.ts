import { z } from "zod";

export const despachoSchema = z.object({
  placaCamion: z.string().min(1, "La placa del camión es obligatoria").max(20),
  conductor: z.string().min(1, "El conductor es obligatorio").max(150),
  fechaDespacho: z.coerce.date({ invalid_type_error: "Ingresa la fecha de despacho" }),
  horaDespacho: z.string().min(1, "La hora de despacho es obligatoria").max(10),
  numeroGuiaRemision: z.string().max(50).optional().or(z.literal("")),
  tarjaIds: z.array(z.string()).min(1, "Selecciona al menos una tarja para despachar"),
});

export type DespachoInput = z.infer<typeof despachoSchema>;
