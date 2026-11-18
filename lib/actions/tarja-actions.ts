"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { numeroTarjaDesdePallet } from "@/lib/utils";

export type TarjaActionState = { error?: string; success?: boolean } | undefined;

export async function crearTarjaAction(palletId: string): Promise<TarjaActionState> {
  const pallet = await prisma.pallet.findUnique({ where: { id: palletId }, include: { tarja: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.tarja) {
    return { success: true };
  }

  try {
    const usuario = await getUsuarioActual();
    // Pedido explícito, 2026-11-18: el número de la tarja ya no es
    // correlativo propio, sigue el número del pallet del que se generó
    // (ej. pallet PAL-1265 -> tarja RPB MP 26-1265).
    const numero = numeroTarjaDesdePallet(pallet.numero, "RPB MP 26-");

    await prisma.tarja.create({
      data: { numero, palletId, creadoPorId: usuario?.id },
    });

    revalidatePath("/acopio/tarjas");
    return { success: true };
  } catch (e) {
    console.error("Error inesperado en crearTarjaAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al generar la tarja." };
  }
}
