"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";

export type TarjaIQFActionState = { error?: string; success?: boolean } | undefined;

export async function crearTarjaIQFAction(palletId: string): Promise<TarjaIQFActionState> {
  const pallet = await prisma.palletIQF.findUnique({ where: { id: palletId }, include: { tarja: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.tarja) {
    return { success: true };
  }

  const usuario = await getUsuarioActual();
  const totalTarjas = await prisma.tarjaIQF.count();
  const numero = `IQF26-${String(totalTarjas + 1).padStart(4, "0")}`;

  await prisma.tarjaIQF.create({
    data: { numero, palletId, creadoPorId: usuario?.id },
  });

  revalidatePath("/acopio/tarjas-iqf");
  return { success: true };
}
