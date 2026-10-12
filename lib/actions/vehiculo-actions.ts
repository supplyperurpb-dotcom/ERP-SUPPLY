"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { vehiculoSchema, type VehiculoInput } from "@/lib/validations/vehiculo";

export type VehiculoActionState = { error?: string; id?: string } | undefined;

async function verificarAdmin(): Promise<{ error?: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede editar la lista de vehículos." };
  }
  return {};
}

const RUTA_LISTA = "/logistica/listas/vehiculos";

export async function crearVehiculoAction(data: VehiculoInput): Promise<VehiculoActionState> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const parsed = vehiculoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.vehiculo.findUnique({ where: { placa: parsed.data.placa } });
  if (existente) {
    return { error: `Ya existe un vehículo con la placa ${parsed.data.placa}.` };
  }

  try {
    const nuevo = await prisma.vehiculo.create({
      data: {
        placa: parsed.data.placa,
        areaUsuaria: parsed.data.areaUsuaria,
        tipo: parsed.data.tipo as never,
      },
    });

    revalidatePath(RUTA_LISTA);
    return { id: nuevo.id };
  } catch (e) {
    console.error("Error inesperado en crearVehiculoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}

export async function actualizarVehiculoAction(id: string, data: VehiculoInput): Promise<VehiculoActionState> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const parsed = vehiculoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const duplicado = await prisma.vehiculo.findUnique({ where: { placa: parsed.data.placa } });
  if (duplicado && duplicado.id !== id) {
    return { error: `Ya existe un vehículo con la placa ${parsed.data.placa}.` };
  }

  try {
    await prisma.vehiculo.update({
      where: { id },
      data: {
        placa: parsed.data.placa,
        areaUsuaria: parsed.data.areaUsuaria,
        tipo: parsed.data.tipo as never,
      },
    });

    revalidatePath(RUTA_LISTA);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarVehiculoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar." };
  }
}

export async function toggleActivoVehiculoAction(id: string): Promise<{ error?: string } | undefined> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id } });
  if (!vehiculo) return { error: "Ese vehículo ya no existe." };

  await prisma.vehiculo.update({ where: { id }, data: { activo: !vehiculo.activo } });

  revalidatePath(RUTA_LISTA);
  return undefined;
}
