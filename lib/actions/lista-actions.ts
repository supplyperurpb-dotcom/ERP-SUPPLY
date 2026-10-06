"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { TIPOS_LISTA } from "@/lib/constants/listas";
import { crearListaValorSchema, renombrarListaValorSchema, type CrearListaValorInput, type RenombrarListaValorInput } from "@/lib/validations/listas";

async function verificarAdmin(): Promise<{ error?: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede editar las listas." };
  }
  return {};
}

function revalidarListas(slug: string) {
  revalidatePath(`/logistica/listas/${slug}`);
  // Los formularios que consumen estas listas las leen al cargar la página.
  revalidatePath("/logistica/solicitudes-pedido/nuevo");
  revalidatePath("/logistica/ordenes-compra/nuevo");
}

export async function crearListaValorAction(data: CrearListaValorInput): Promise<{ error?: string } | undefined> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const parsed = crearListaValorSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.listaValor.findUnique({
    where: { tipo_nombre: { tipo: parsed.data.tipo, nombre: parsed.data.nombre } },
  });
  if (existente) {
    return { error: `Ya existe "${parsed.data.nombre}" en esta lista.` };
  }

  const ultimo = await prisma.listaValor.findFirst({ where: { tipo: parsed.data.tipo }, orderBy: { orden: "desc" } });

  await prisma.listaValor.create({
    data: { tipo: parsed.data.tipo, nombre: parsed.data.nombre, orden: (ultimo?.orden ?? -1) + 1 },
  });

  revalidarListas(TIPOS_LISTA.find((t) => t.tipo === parsed.data.tipo)!.slug);
  return undefined;
}

export async function renombrarListaValorAction(data: RenombrarListaValorInput): Promise<{ error?: string } | undefined> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const parsed = renombrarListaValorSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const valor = await prisma.listaValor.findUnique({ where: { id: parsed.data.id } });
  if (!valor) return { error: "Ese valor ya no existe." };

  const duplicado = await prisma.listaValor.findUnique({
    where: { tipo_nombre: { tipo: valor.tipo, nombre: parsed.data.nombre } },
  });
  if (duplicado && duplicado.id !== valor.id) {
    return { error: `Ya existe "${parsed.data.nombre}" en esta lista.` };
  }

  await prisma.listaValor.update({ where: { id: valor.id }, data: { nombre: parsed.data.nombre } });

  revalidarListas(TIPOS_LISTA.find((t) => t.tipo === valor.tipo)!.slug);
  return undefined;
}

export async function toggleActivoListaValorAction(id: string): Promise<{ error?: string } | undefined> {
  const permiso = await verificarAdmin();
  if (permiso.error) return permiso;

  const valor = await prisma.listaValor.findUnique({ where: { id } });
  if (!valor) return { error: "Ese valor ya no existe." };

  await prisma.listaValor.update({ where: { id }, data: { activo: !valor.activo } });

  revalidarListas(TIPOS_LISTA.find((t) => t.tipo === valor.tipo)!.slug);
  return undefined;
}
