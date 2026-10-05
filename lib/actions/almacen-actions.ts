"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { almacenSchema, type AlmacenInput } from "@/lib/validations/almacen";

export type AlmacenActionState = { error?: string; success?: boolean } | undefined;

function datosAlmacen(data: AlmacenInput) {
  const { codigo, nombre, tipo, ubicacion, activo, esGeneral, categoriaGeneral, almacenPadreId } = data;
  return {
    codigo,
    nombre,
    tipo,
    ubicacion: ubicacion || null,
    activo,
    esGeneral,
    categoriaGeneral: esGeneral ? categoriaGeneral || null : null,
    almacenPadreId: esGeneral ? null : almacenPadreId || null,
  };
}

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
    await prisma.almacen.create({ data: datosAlmacen(parsed.data) });
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

  if (!parsed.data.esGeneral && parsed.data.almacenPadreId === id) {
    return { error: "Un almacén no puede ser su propio almacén general." };
  }

  try {
    await prisma.almacen.update({ where: { id }, data: datosAlmacen(parsed.data) });
  } catch (e) {
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el almacén." };
  }

  revalidatePath("/logistica/almacenes");
  return { success: true };
}
