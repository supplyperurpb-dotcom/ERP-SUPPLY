"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { despachoSchema, type DespachoInput } from "@/lib/validations/despacho";

export type DespachoActionState = { error?: string; success?: boolean } | undefined;

export async function crearDespachoAction(data: DespachoInput): Promise<DespachoActionState> {
  const parsed = despachoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const tarjas = await prisma.tarja.findMany({ where: { id: { in: parsed.data.tarjaIds } } });
  if (tarjas.length !== parsed.data.tarjaIds.length) {
    return { error: "Una de las tarjas seleccionadas ya no existe. Actualiza la página e intenta de nuevo." };
  }
  const yaDespachada = tarjas.find((t) => t.despachoId !== null);
  if (yaDespachada) {
    return {
      error: `La tarja ${yaDespachada.numero} ya fue despachada por otro despacho. Actualiza la página e intenta de nuevo.`,
    };
  }

  const usuario = await getUsuarioActual();
  const totalDespachos = await prisma.despacho.count();
  const numero = `DESP-${String(totalDespachos + 1).padStart(4, "0")}`;

  await prisma.$transaction(async (tx) => {
    const despacho = await tx.despacho.create({
      data: {
        numero,
        placaCamion: parsed.data.placaCamion,
        conductor: parsed.data.conductor,
        fechaDespacho: parsed.data.fechaDespacho,
        horaDespacho: parsed.data.horaDespacho,
        numeroGuiaRemision: parsed.data.numeroGuiaRemision || null,
        creadoPorId: usuario?.id,
      },
    });

    await tx.tarja.updateMany({
      where: { id: { in: parsed.data.tarjaIds } },
      data: { despachoId: despacho.id },
    });
  });

  revalidatePath("/acopio/despacho");
  revalidatePath("/acopio/tarjas");
  return { success: true };
}
