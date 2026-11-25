"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";

// Autoservicio (pedido explícito, 2026-11-25): cualquier usuario puede
// marcarse a sí mismo de vacaciones desde /perfil — no tiene efecto salvo
// que sea un aprobador especial (ver resolverAprobadorEfectivo en
// lib/compras.ts), no se restringe la UI por eso para no complicar el
// alcance. Mismo criterio de "acción sobre uno mismo" que
// cambiarPasswordPropiaAction (lib/actions/auth-actions.ts): parte de
// getUsuarioActual() y escribe por usuario.id, como el resto del sistema.
export async function alternarVacacionesAction(enVacaciones: boolean): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };

    await prisma.usuario.update({ where: { id: usuario.id }, data: { enVacaciones } });

    revalidatePath("/perfil");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en alternarVacacionesAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar tus vacaciones." };
  }
}
