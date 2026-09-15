"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";

export type TarjaIQFActionState = { error?: string; success?: boolean } | undefined;

export async function crearTarjaIQFAction(palletId: string): Promise<TarjaIQFActionState> {
  const pallet = await prisma.palletIQF.findUnique({ where: { id: palletId }, include: { tarja: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.tarja) {
    return { success: true };
  }

  try {
    const usuario = await getUsuarioActual();
    const tarjasExistentes = await prisma.tarjaIQF.findMany({ select: { numero: true } });
    const numero = siguienteNumero(tarjasExistentes.map((t) => t.numero), "IQF26-");

    await prisma.tarjaIQF.create({
      data: { numero, palletId, creadoPorId: usuario?.id },
    });

    revalidatePath("/acopio/tarjas-iqf");
    return { success: true };
  } catch (e) {
    console.error("Error inesperado en crearTarjaIQFAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al generar la tarja." };
  }
}
