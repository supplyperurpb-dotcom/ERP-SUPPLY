import { z } from "zod";

// Línea de pesaje de Ingreso IQF: sin módulo/turno/formato (no aplican al
// descarte de planta) y sin tipoProducto (queda fijo en "Descarte Planta",
// asignado por el server action). El resto replica palletFormSchema de
// Ingreso de Materia Prima — ver lib/validations/ingreso-fruta.ts.
export const palletIQFFormSchema = z.object({
  variedad: z.string().min(1, "La variedad es obligatoria").max(50),
  tipoBandejaId: z.string().min(1, "Selecciona el tipo de bandeja"),
  tipoPalletId: z.string().optional().or(z.literal("")),
  cantidadBandejas: z.coerce
    .number({ invalid_type_error: "Ingresa la cantidad de bandejas" })
    .int("Debe ser un número entero")
    .positive("Debe ser mayor a 0"),
  pesoBrutoTotalKg: z.coerce
    .number({ invalid_type_error: "Ingresa el peso bruto" })
    .positive("Debe ser mayor a 0"),
  palletAsignado: z.string().min(1, "Asigna esta línea a un pallet (nuevo o existente)"),
});

export type PalletIQFFormInput = z.infer<typeof palletIQFFormSchema>;

export const ingresoIQFSchema = z.object({
  proveedorId: z.string().min(1, "Selecciona el proveedor/fundo"),
  fechaCosecha: z.coerce.date({ invalid_type_error: "Ingresa la fecha de cosecha" }),
  horaIngreso: z.string().min(1, "La hora de recepción es obligatoria").max(10),
  placaTransporte: z.string().min(1, "La placa del vehículo es obligatoria").max(20),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  pallets: z.array(palletIQFFormSchema).min(1, "Agrega al menos una línea de pesaje"),
});

export type IngresoIQFInput = z.infer<typeof ingresoIQFSchema>;
