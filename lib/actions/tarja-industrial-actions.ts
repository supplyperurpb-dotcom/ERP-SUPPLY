"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { numeroTarjaDesdePallet } from "@/lib/utils";

export type TarjaIndustrialActionState = { error?: string; success?: boolean } | undefined;

export async function crearTarjaIndustrialAction(palletId: string): Promise<TarjaIndustrialActionState> {
  const pallet = await prisma.palletIndustrial.findUnique({ where: { id: palletId }, include: { tarja: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.tarja) {
    return { success: true };
  }

  try {
    const usuario = await getUsuarioActual();
    // Pedido explícito, 2026-11-18: mismo criterio que la tarja de materia
    // prima — el número sigue al del pallet (ej. pallet PINDUSTRIAL-0123 ->
    // tarja RPB IND 26-0123).
    const numero = numeroTarjaDesdePallet(pallet.numero, "RPB IND 26-");

    await prisma.tarjaIndustrial.create({
      data: { numero, palletId, creadoPorId: usuario?.id },
    });

    revalidatePath("/acopio/tarjas-industrial");
    return { success: true };
  } catch (e) {
    console.error("Error inesperado en crearTarjaIndustrialAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al generar la tarja." };
  }
}
