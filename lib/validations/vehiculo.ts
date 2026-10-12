import { z } from "zod";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;

export const TIPOS_VEHICULO = [
  { valor: "CAMIONETA", nombre: "Camioneta" },
  { valor: "TRACTOR", nombre: "Tractor" },
  { valor: "CISTERNA", nombre: "Cisterna" },
  { valor: "EQUIPOS_MENORES", nombre: "Equipos menores" },
] as const;

export const vehiculoSchema = z.object({
  placa: z
    .string()
    .trim()
    .min(1, "La placa es obligatoria")
    .max(20)
    .transform((v) => v.toUpperCase()),
  // Código interno del equipo (opcional, pero único cuando se indica — ver
  // crearVehiculoAction/actualizarVehiculoAction).
  codigoEquipo: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v.toUpperCase())
    .optional()
    .or(z.literal("")),
  areaUsuaria: z.enum(AREAS, { required_error: "Selecciona el área usuaria" }),
  tipo: z.enum(
    TIPOS_VEHICULO.map((t) => t.valor) as [string, ...string[]],
    { required_error: "Selecciona el tipo de vehículo" }
  ),
});

export type VehiculoInput = z.infer<typeof vehiculoSchema>;
