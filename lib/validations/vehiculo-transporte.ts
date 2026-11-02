import { z } from "zod";

export const TIPOS_PROPIEDAD_VEHICULO_TRANSPORTE = [
  { valor: "PROPIO", nombre: "Propio" },
  { valor: "TERCERO", nombre: "Tercero" },
] as const;

export const vehiculoTransporteSchema = z.object({
  placa: z
    .string()
    .trim()
    .min(1, "La placa es obligatoria")
    .max(20)
    .transform((v) => v.toUpperCase()),
  tipo: z.enum(["PROPIO", "TERCERO"], { required_error: "Selecciona el tipo de vehículo" }),
});

export type VehiculoTransporteInput = z.infer<typeof vehiculoTransporteSchema>;
