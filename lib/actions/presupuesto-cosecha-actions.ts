"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { VARIEDADES_COSECHA } from "@/lib/constants/modulos";

export type PresupuestoCosechaActionState = { error?: string; success?: boolean } | undefined;

function aNumeroONulo(valor: FormDataEntryValue | null): number | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

async function verificarAdmin() {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    return "No tienes permiso para editar el presupuesto de cosecha.";
  }
  return null;
}

// Grilla semana x variedad: cada celda que llega con un valor (vacío = "no
// cambiar", no "poner en cero") se guarda con upsert — no hace falta que el
// usuario haya llenado las 52 semanas para poder guardar.
export async function guardarPresupuestoSemanalAction(
  _prevState: PresupuestoCosechaActionState,
  formData: FormData
): Promise<PresupuestoCosechaActionState> {
  const errorAdmin = await verificarAdmin();
  if (errorAdmin) return { error: errorAdmin };

  const anio = Number(formData.get("anio"));
  if (!Number.isFinite(anio)) return { error: "Año inválido." };

  const filas = new Map<string, { semana: number; variedad: string; kgBudget: number | null; kgOct: number | null }>();
  for (const [nombre, valor] of formData.entries()) {
    const m = nombre.match(/^(kgBudget|kgOct)__(\d+)__(.+)$/);
    if (!m) continue;
    const [, campo, semanaTexto, variedad] = m;
    const semana = Number(semanaTexto);
    const clave = `${semana}__${variedad}`;
    const fila = filas.get(clave) ?? { semana, variedad, kgBudget: null, kgOct: null };
    const numero = aNumeroONulo(valor);
    if (campo === "kgBudget") fila.kgBudget = numero;
    else fila.kgOct = numero;
    filas.set(clave, fila);
  }

  const aGuardar = Array.from(filas.values()).filter((f) => f.kgBudget !== null || f.kgOct !== null);
  if (aGuardar.length === 0) return { success: true };

  try {
    await prisma.$transaction(
      aGuardar.map((f) =>
        prisma.presupuestoCosechaSemana.upsert({
          where: { anio_semana_variedad: { anio, semana: f.semana, variedad: f.variedad } },
          update: {
            ...(f.kgBudget !== null ? { kgBudget: f.kgBudget } : {}),
            ...(f.kgOct !== null ? { kgOct: f.kgOct } : {}),
          },
          create: { anio, semana: f.semana, variedad: f.variedad, kgBudget: f.kgBudget ?? 0, kgOct: f.kgOct ?? 0 },
        })
      )
    );
    revalidatePath("/acopio/presupuesto");
    revalidatePath("/acopio/reporte/general");
    return { success: true };
  } catch (e) {
    console.error("Error al guardar presupuesto semanal:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}

export async function guardarPresupuestoVariedadAction(
  _prevState: PresupuestoCosechaActionState,
  formData: FormData
): Promise<PresupuestoCosechaActionState> {
  const errorAdmin = await verificarAdmin();
  if (errorAdmin) return { error: errorAdmin };

  const anio = Number(formData.get("anio"));
  if (!Number.isFinite(anio)) return { error: "Año inválido." };

  const aGuardar = VARIEDADES_COSECHA.map((variedad) => ({
    variedad,
    hectareas: aNumeroONulo(formData.get(`hectareas__${variedad}`)),
  })).filter((f): f is { variedad: (typeof VARIEDADES_COSECHA)[number]; hectareas: number } => f.hectareas !== null);

  if (aGuardar.length === 0) return { success: true };

  try {
    await prisma.$transaction(
      aGuardar.map((f) =>
        prisma.presupuestoCosechaVariedad.upsert({
          where: { anio_variedad: { anio, variedad: f.variedad } },
          update: { hectareas: f.hectareas },
          create: { anio, variedad: f.variedad, hectareas: f.hectareas },
        })
      )
    );
    revalidatePath("/acopio/presupuesto");
    revalidatePath("/acopio/reporte/general");
    return { success: true };
  } catch (e) {
    console.error("Error al guardar hectáreas por variedad:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}
