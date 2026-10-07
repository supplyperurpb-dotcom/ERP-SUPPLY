"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { retiradorAutorizadoSchema, type RetiradorAutorizadoInput } from "@/lib/validations/retirador-autorizado";

export type RetiradorAutorizadoActionState = { error?: string; id?: string } | undefined;

async function verificarAdmin(): Promise<{ error?: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede editar la lista de retiradores autorizados." };
  }
  return {};
}

const RUTA_LISTA = "/logistica/listas/retiradores-autorizados";

export async function crearRetiradorAutorizadoAction(
  data: RetiradorAutorizadoInput
): Promise<RetiradorAutorizadoActionState> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const parsed = retiradorAutorizadoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.retiradorAutorizado.findUnique({ where: { dni: parsed.data.dni } });
  if (existente) {
    return { error: `Ya existe un retirador autorizado con el DNI ${parsed.data.dni}.` };
  }

  try {
    const nuevo = await prisma.retiradorAutorizado.create({
      data: {
        nombres: parsed.data.nombres,
        apellidos: parsed.data.apellidos,
        dni: parsed.data.dni,
        area: parsed.data.area,
        almacenesPermitidos: {
          create: parsed.data.almacenesPermitidosIds.map((almacenId) => ({ almacenId })),
        },
      },
    });

    revalidatePath(RUTA_LISTA);
    return { id: nuevo.id };
  } catch (e) {
    console.error("Error inesperado en crearRetiradorAutorizadoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}

export async function actualizarRetiradorAutorizadoAction(
  id: string,
  data: RetiradorAutorizadoInput
): Promise<RetiradorAutorizadoActionState> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const parsed = retiradorAutorizadoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const duplicado = await prisma.retiradorAutorizado.findUnique({ where: { dni: parsed.data.dni } });
  if (duplicado && duplicado.id !== id) {
    return { error: `Ya existe un retirador autorizado con el DNI ${parsed.data.dni}.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.retiradorAutorizado.update({
        where: { id },
        data: {
          nombres: parsed.data.nombres,
          apellidos: parsed.data.apellidos,
          dni: parsed.data.dni,
          area: parsed.data.area,
        },
      });
      await tx.retiradorAlmacenPermitido.deleteMany({ where: { retiradorAutorizadoId: id } });
      await tx.retiradorAlmacenPermitido.createMany({
        data: parsed.data.almacenesPermitidosIds.map((almacenId) => ({ retiradorAutorizadoId: id, almacenId })),
      });
    });

    revalidatePath(RUTA_LISTA);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarRetiradorAutorizadoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar." };
  }
}

export async function toggleActivoRetiradorAutorizadoAction(id: string): Promise<{ error?: string } | undefined> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const retirador = await prisma.retiradorAutorizado.findUnique({ where: { id } });
  if (!retirador) return { error: "Ese retirador ya no existe." };

  await prisma.retiradorAutorizado.update({ where: { id }, data: { activo: !retirador.activo } });

  revalidatePath(RUTA_LISTA);
  return undefined;
}
