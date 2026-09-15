"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { despachoSchema, type DespachoInput } from "@/lib/validations/despacho";
import { siguienteNumero } from "@/lib/utils";

export type DespachoIQFActionState = { error?: string; success?: boolean } | undefined;

export async function crearDespachoIQFAction(data: DespachoInput): Promise<DespachoIQFActionState> {
  const parsed = despachoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const tarjas = await prisma.tarjaIQF.findMany({ where: { id: { in: parsed.data.tarjaIds } } });
  if (tarjas.length !== parsed.data.tarjaIds.length) {
    return { error: "Una de las tarjas seleccionadas ya no existe. Actualiza la página e intenta de nuevo." };
  }
  const yaDespachada = tarjas.find((t) => t.despachoId !== null);
  if (yaDespachada) {
    return {
      error: `La tarja ${yaDespachada.numero} ya fue despachada por otro despacho. Actualiza la página e intenta de nuevo.`,
    };
  }

  try {
    const usuario = await getUsuarioActual();
    const despachosExistentes = await prisma.despachoIQF.findMany({ select: { numero: true } });
    const numero = siguienteNumero(despachosExistentes.map((d) => d.numero), "DESPIQF-");

    await prisma.$transaction(async (tx) => {
      const despacho = await tx.despachoIQF.create({
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

      await tx.tarjaIQF.updateMany({
        where: { id: { in: parsed.data.tarjaIds } },
        data: { despachoId: despacho.id },
      });
    });

    revalidatePath("/acopio/despacho-iqf");
    revalidatePath("/acopio/tarjas-iqf");
    return { success: true };
  } catch (e) {
    console.error("Error inesperado en crearDespachoIQFAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el despacho." };
  }
}
