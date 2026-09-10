"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { skuSchema } from "@/lib/validations/sku";

export type SkuActionState = { error?: string; success?: boolean } | undefined;

export async function crearSkuAction(_prevState: SkuActionState, formData: FormData): Promise<SkuActionState> {
  const parsed = skuSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const usuario = await getUsuarioActual();

  const existente = await prisma.sku.findUnique({ where: { codigo: parsed.data.codigo } });
  if (existente) {
    return { error: `Ya existe un SKU con el código ${parsed.data.codigo}` };
  }

  await prisma.sku.create({
    data: { ...parsed.data, creadoPorId: usuario?.id },
  });

  revalidatePath("/logistica/sku");
  return { success: true };
}

export async function actualizarSkuAction(
  id: string,
  _prevState: SkuActionState,
  formData: FormData
): Promise<SkuActionState> {
  const parsed = skuSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.sku.update({ where: { id }, data: parsed.data });

  revalidatePath("/logistica/sku");
  return { success: true };
}

export async function eliminarSkuAction(id: string) {
  await prisma.sku.delete({ where: { id } });
  revalidatePath("/logistica/sku");
}
