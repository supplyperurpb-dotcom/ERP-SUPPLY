"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { vehiculoTransporteSchema, type VehiculoTransporteInput } from "@/lib/validations/vehiculo-transporte";

export type VehiculoTransporteActionState = { error?: string; id?: string; placa?: string; tipo?: string } | undefined;

const RUTAS_FORMULARIOS = [
  "/acopio/ingresos/nuevo",
  "/acopio/ingreso-iqf/nuevo",
  "/acopio/despacho/nuevo",
  "/acopio/despacho-iqf/nuevo",
];

// Se usa desde "Registrar vehículo" en los formularios de Ingreso/Despacho
// de Acopio: cualquier usuario que llegue a esos formularios puede dar de
// alta una placa nueva sobre la marcha (a diferencia de Vehiculo, el
// catálogo de activos propios, que solo un ADMIN edita).
export async function crearVehiculoTransporteAction(data: VehiculoTransporteInput): Promise<VehiculoTransporteActionState> {
  const parsed = vehiculoTransporteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.vehiculoTransporte.findUnique({ where: { placa: parsed.data.placa } });
  if (existente) {
    // Ya registrada (quizás por otro usuario momentos antes): se devuelve
    // como si se hubiera creado, para que el formulario solo la seleccione.
    return { id: existente.id, placa: existente.placa, tipo: existente.tipo };
  }

  try {
    const nuevo = await prisma.vehiculoTransporte.create({ data: parsed.data });

    for (const ruta of RUTAS_FORMULARIOS) revalidatePath(ruta);
    return { id: nuevo.id, placa: nuevo.placa, tipo: nuevo.tipo };
  } catch (e) {
    console.error("Error inesperado en crearVehiculoTransporteAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}
