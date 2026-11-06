import { z } from "zod";

export const despachoSchema = z.object({
  placaCamion: z.string().min(1, "La placa del camión es obligatoria").max(20),
  conductor: z.string().min(1, "El conductor es obligatorio").max(150),
  fechaDespacho: z.coerce.date({ invalid_type_error: "Ingresa la fecha de despacho" }),
  horaDespacho: z.string().min(1, "La hora de despacho es obligatoria").max(10),
  tarjaIds: z.array(z.string()).min(1, "Selecciona al menos una tarja para despachar"),
});

export type DespachoInput = z.infer<typeof despachoSchema>;

// Para "Culminar proceso" en el Packing List Acopio (ver
// /acopio/despacho/[id]): la guía de remisión real (número + adjunto) ya
// no se pide al crear el despacho, solo al culminarlo.
export const culminarDespachoSchema = z.object({
  numeroGuiaRemision: z.string().min(1, "El número de guía de remisión es obligatorio").max(50),
  guiaRemisionArchivo: z.string().min(1, "Adjunta la guía de remisión (foto o PDF)"),
});

export type CulminarDespachoInput = z.infer<typeof culminarDespachoSchema>;
