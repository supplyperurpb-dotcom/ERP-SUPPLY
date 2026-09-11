"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";

export type TarjaActionState = { error?: string; success?: boolean } | undefined;

export async function crearTarjaAction(palletId: string): Promise<TarjaActionState> {
  const pallet = await prisma.pallet.findUnique({ where: { id: palletId }, include: { tarja: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.tarja) {
    return { success: true };
  }

  const usuario = await getUsuarioActual();
  const totalTarjas = await prisma.tarja.count();
  const numero = `TJ-${String(totalTarjas + 1).padStart(4, "0")}`;

  await prisma.tarja.create({
    data: { numero, palletId, creadoPorId: usuario?.id },
  });

  revalidatePath("/acopio/tarjas");
  return { success: true };
}
