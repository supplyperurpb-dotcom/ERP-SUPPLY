"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";

export type PalletActionState = { error?: string; success?: boolean } | undefined;

// Cierre manual: permite dejar de usar un pallet antes de llegar a la
// capacidad máxima (ver CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET). Una vez
// CERRADO deja de aparecer entre los pallets abiertos que ofrecen los
// formularios de Ingreso, así que no puede recibir más bandejas.
export async function cerrarPalletAction(palletId: string): Promise<PalletActionState> {
  const pallet = await prisma.pallet.findUnique({ where: { id: palletId }, select: { estado: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.estado === "CERRADO") {
    return { success: true };
  }

  await prisma.pallet.update({ where: { id: palletId }, data: { estado: "CERRADO" } });

  revalidatePath("/acopio/tarjas");
  revalidatePath("/acopio/ingresos/nuevo");
  return { success: true };
}

export async function cerrarPalletIndustrialAction(palletId: string): Promise<PalletActionState> {
  const pallet = await prisma.palletIndustrial.findUnique({ where: { id: palletId }, select: { estado: true } });
  if (!pallet) {
    return { error: "El pallet ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (pallet.estado === "CERRADO") {
    return { success: true };
  }

  await prisma.palletIndustrial.update({ where: { id: palletId }, data: { estado: "CERRADO" } });

  revalidatePath("/acopio/tarjas-industrial");
  revalidatePath("/acopio/ingresos/nuevo");
  revalidatePath("/acopio/ingreso-industrial/nuevo");
  return { success: true };
}
