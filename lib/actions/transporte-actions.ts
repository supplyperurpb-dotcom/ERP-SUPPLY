"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { camionSchema, conductorSchema } from "@/lib/validations/transporte";

export type TransporteActionState = { error?: string; success?: boolean } | undefined;

const RUTA_TRANSPORTE = "/acopio/transporte";

export async function crearCamionAction(
  _prevState: TransporteActionState,
  formData: FormData
): Promise<TransporteActionState> {
  const parsed = camionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existente = await prisma.camion.findUnique({ where: { placa: parsed.data.placa } });
  if (existente) {
    return { error: `Ya existe un camión con la placa ${parsed.data.placa}.` };
  }

  await prisma.camion.create({ data: parsed.data });
  revalidatePath(RUTA_TRANSPORTE);
  revalidatePath("/acopio/despacho/nuevo");
  return { success: true };
}

export async function actualizarCamionAction(
  id: string,
  _prevState: TransporteActionState,
  formData: FormData
): Promise<TransporteActionState> {
  const parsed = camionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const duplicado = await prisma.camion.findUnique({ where: { placa: parsed.data.placa } });
  if (duplicado && duplicado.id !== id) {
    return { error: `Ya existe un camión con la placa ${parsed.data.placa}.` };
  }

  await prisma.camion.update({ where: { id }, data: parsed.data });
  revalidatePath(RUTA_TRANSPORTE);
  revalidatePath("/acopio/despacho/nuevo");
  return { success: true };
}

export async function toggleActivoCamionAction(id: string): Promise<TransporteActionState> {
  const camion = await prisma.camion.findUnique({ where: { id } });
  if (!camion) return { error: "Ese camión ya no existe." };

  await prisma.camion.update({ where: { id }, data: { activo: !camion.activo } });
  revalidatePath(RUTA_TRANSPORTE);
  revalidatePath("/acopio/despacho/nuevo");
  return { success: true };
}

export async function crearConductorAction(
  _prevState: TransporteActionState,
  formData: FormData
): Promise<TransporteActionState> {
  const parsed = conductorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.conductor.create({ data: parsed.data });
  revalidatePath(RUTA_TRANSPORTE);
  revalidatePath("/acopio/despacho/nuevo");
  return { success: true };
}

export async function actualizarConductorAction(
  id: string,
  _prevState: TransporteActionState,
  formData: FormData
): Promise<TransporteActionState> {
  const parsed = conductorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.conductor.update({ where: { id }, data: parsed.data });
  revalidatePath(RUTA_TRANSPORTE);
  revalidatePath("/acopio/despacho/nuevo");
  return { success: true };
}

export async function toggleActivoConductorAction(id: string): Promise<TransporteActionState> {
  const conductor = await prisma.conductor.findUnique({ where: { id } });
  if (!conductor) return { error: "Ese conductor ya no existe." };

  await prisma.conductor.update({ where: { id }, data: { activo: !conductor.activo } });
  revalidatePath(RUTA_TRANSPORTE);
  revalidatePath("/acopio/despacho/nuevo");
  return { success: true };
}
