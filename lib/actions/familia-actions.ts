"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { familiaSchema, subfamiliaSchema, type FamiliaInput, type SubfamiliaInput } from "@/lib/validations/familia";

// Familia/Subfamilia activas, usadas tanto por el submódulo de Listas
// (todas) como por los 3 formularios de Creación de Materiales (filtrando
// por nombre, para que cada uno pida solo lo suyo).
export async function obtenerFamiliasConSubfamilias(nombres?: string[]) {
  return prisma.familia.findMany({
    where: { activo: true, ...(nombres ? { nombre: { in: nombres } } : {}) },
    orderBy: { orden: "asc" },
    include: {
      subfamilias: { where: { activo: true }, orderBy: { orden: "asc" } },
    },
  });
}

export type FamiliaActionState = { error?: string; success?: boolean } | undefined;

export async function crearFamiliaAction(data: FamiliaInput): Promise<FamiliaActionState> {
  const parsed = familiaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, prefijo } = parsed.data;

  const existente = await prisma.familia.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  if (existente) {
    return { error: `Ya existe la familia "${existente.nombre}".` };
  }

  const ultima = await prisma.familia.findFirst({ orderBy: { orden: "desc" }, select: { orden: true } });

  await prisma.familia.create({ data: { nombre, prefijo, orden: (ultima?.orden ?? -1) + 1 } });

  revalidatePath("/logistica/listas/categorias");
  return { success: true };
}

export async function crearSubfamiliaAction(data: SubfamiliaInput): Promise<FamiliaActionState> {
  const parsed = subfamiliaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { familiaId, nombre, prefijo } = parsed.data;

  const familia = await prisma.familia.findUnique({ where: { id: familiaId } });
  if (!familia) return { error: "La familia seleccionada no existe." };

  const existente = await prisma.subfamilia.findFirst({
    where: { familiaId, nombre: { equals: nombre, mode: "insensitive" } },
  });
  if (existente) {
    return { error: `"${familia.nombre}" ya tiene una subfamilia "${existente.nombre}".` };
  }

  const ultima = await prisma.subfamilia.findFirst({
    where: { familiaId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  await prisma.subfamilia.create({
    data: { familiaId, nombre, prefijo: prefijo || null, orden: (ultima?.orden ?? -1) + 1 },
  });

  revalidatePath("/logistica/listas/categorias");
  return { success: true };
}

export async function cambiarActivoFamiliaAction(id: string, activo: boolean): Promise<FamiliaActionState> {
  await prisma.familia.update({ where: { id }, data: { activo } });
  revalidatePath("/logistica/listas/categorias");
  return { success: true };
}

export async function cambiarActivoSubfamiliaAction(id: string, activo: boolean): Promise<FamiliaActionState> {
  await prisma.subfamilia.update({ where: { id }, data: { activo } });
  revalidatePath("/logistica/listas/categorias");
  return { success: true };
}
