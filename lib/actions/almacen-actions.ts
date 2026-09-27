"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { almacenSchema } from "@/lib/validations/almacen";

export type AlmacenActionState = { error?: string; success?: boolean } | undefined;

export async function crearAlmacenAction(_prevState: AlmacenActionState, formData: FormData): Promise<AlmacenActionState> {
  const parsed = almacenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.almacen.findUnique({ where: { codigo: parsed.data.codigo } });
  if (existente) {
    return { error: `Ya existe un almacén con el código ${parsed.data.codigo}` };
  }

  try {
    await prisma.almacen.create({
      data: { ...parsed.data, ubicacion: parsed.data.ubicacion || null },
    });
  } catch (e) {
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al crear el almacén." };
  }

  revalidatePath("/logistica/almacenes");
  return { success: true };
}

export async function actualizarAlmacenAction(
  id: string,
  _prevState: AlmacenActionState,
  formData: FormData
): Promise<AlmacenActionState> {
  const parsed = almacenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await prisma.almacen.update({
      where: { id },
      data: { ...parsed.data, ubicacion: parsed.data.ubicacion || null },
    });
  } catch (e) {
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el almacén." };
  }

  revalidatePath("/logistica/almacenes");
  return { success: true };
}
