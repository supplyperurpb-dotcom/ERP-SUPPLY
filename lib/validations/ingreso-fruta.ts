import { z } from "zod";

// Una línea = un grupo de bandejas pesado, con su propia trazabilidad de
// origen (un mismo camión puede traer fruta de varios módulos/turnos del
// fundo, y hasta de más de una variedad).
export const palletFormSchema = z.object({
  modulo: z.string().min(1, "El módulo es obligatorio").max(50),
  turno: z.string().min(1, "El turno es obligatorio").max(50),
  variedad: z.string().min(1, "La variedad es obligatoria").max(50),
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

// La cabecera representa la llegada del camión: se registra una sola vez.
export const ingresoFrutaSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona el proveedor/fundo"),
  lote: z.string().min(1, "El lote es obligatorio").max(50),
  fechaCosecha: z.coerce.date({ invalid_type_error: "Ingresa la fecha de cosecha" }),
  horaIngreso: z.string().min(1, "La hora de recepción es obligatoria").max(10),
  placaTransporte: z.string().min(1, "La placa del vehículo es obligatoria").max(20),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  pallets: z.array(palletFormSchema).min(1, "Agrega al menos una línea de pesaje"),
});

export type IngresoFrutaInput = z.infer<typeof ingresoFrutaSchema>;
