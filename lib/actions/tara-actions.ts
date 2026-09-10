"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { tipoBandejaSchema, tipoPalletSchema } from "@/lib/validations/tara";

export type TaraActionState = { error?: string; success?: boolean } | undefined;

const RUTA_CATALOGO_TARAS = "/acopio/catalogo-taras";

export async function crearTipoBandejaAction(
  _prevState: TaraActionState,
  formData: FormData
): Promise<TaraActionState> {
  const parsed = tipoBandejaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.tipoBandeja.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) {
    return { error: `Ya existe un tipo de bandeja con el nombre ${parsed.data.nombre}` };
  }

  await prisma.tipoBandeja.create({ data: parsed.data });

  revalidatePath(RUTA_CATALOGO_TARAS);
  return { success: true };
}

export async function actualizarTipoBandejaAction(
  id: string,
  _prevState: TaraActionState,
  formData: FormData
): Promise<TaraActionState> {
  const parsed = tipoBandejaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.tipoBandeja.update({ where: { id }, data: parsed.data });

  revalidatePath(RUTA_CATALOGO_TARAS);
  return { success: true };
}

export async function eliminarTipoBandejaAction(id: string) {
  await prisma.tipoBandeja.delete({ where: { id } });
  revalidatePath(RUTA_CATALOGO_TARAS);
}

export async function crearTipoPalletAction(
  _prevState: TaraActionState,
  formData: FormData
): Promise<TaraActionState> {
  const parsed = tipoPalletSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.tipoPallet.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existente) {
    return { error: `Ya existe un tipo de pallet con el nombre ${parsed.data.nombre}` };
  }

  await prisma.tipoPallet.create({ data: parsed.data });

  revalidatePath(RUTA_CATALOGO_TARAS);
  return { success: true };
}

export async function actualizarTipoPalletAction(
  id: string,
  _prevState: TaraActionState,
  formData: FormData
): Promise<TaraActionState> {
  const parsed = tipoPalletSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.tipoPallet.update({ where: { id }, data: parsed.data });

  revalidatePath(RUTA_CATALOGO_TARAS);
  return { success: true };
}

export async function eliminarTipoPalletAction(id: string) {
  await prisma.tipoPallet.delete({ where: { id } });
  revalidatePath(RUTA_CATALOGO_TARAS);
}
