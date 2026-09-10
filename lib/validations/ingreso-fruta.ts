import { z } from "zod";

export const palletFormSchema = z.object({
  tipoBandejaId: z.string().min(1, "Selecciona el tipo de bandeja"),
  cantidadBandejas: z.coerce
    .number({ invalid_type_error: "Ingresa la cantidad de bandejas" })
    .int("Debe ser un número entero")
    .positive("Debe ser mayor a 0"),
  pesoBrutoTotalKg: z.coerce
    .number({ invalid_type_error: "Ingresa el peso bruto" })
    .positive("Debe ser mayor a 0"),
});

export type PalletFormInput = z.infer<typeof palletFormSchema>;

export const ingresoFrutaSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona el proveedor/fundo"),
  modulo: z.string().min(1, "El módulo es obligatorio").max(50),
  turno: z.string().min(1, "El turno es obligatorio").max(50),
  lote: z.string().min(1, "El lote es obligatorio").max(50),
  variedad: z.string().min(1, "La variedad es obligatoria").max(50),
  fechaCosecha: z.coerce.date({ invalid_type_error: "Ingresa la fecha de cosecha" }),
  horaIngreso: z.string().min(1, "La hora de recepción es obligatoria").max(10),
  placaTransporte: z.string().max(20).optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  pallets: z.array(palletFormSchema).min(1, "Agrega al menos un registro de pesaje"),
});

export type IngresoFrutaInput = z.infer<typeof ingresoFrutaSchema>;
