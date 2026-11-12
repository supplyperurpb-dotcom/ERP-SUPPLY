"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { siguienteNumero } from "@/lib/utils";
import { PREFIJO_CODIGO_ALMACEN_POR_CATEGORIA } from "@/lib/constants/sku";
import { almacenSchema, type AlmacenInput } from "@/lib/validations/almacen";

export type AlmacenActionState = { error?: string; success?: boolean } | undefined;

function datosAlmacen(data: AlmacenInput) {
  const { nombre, tipo, ubicacion, activo, esGeneral, categoriaGeneral, almacenPadreId } = data;
  return {
    nombre,
    tipo,
    ubicacion: ubicacion || null,
    activo,
    esGeneral,
    categoriaGeneral: esGeneral ? categoriaGeneral || null : null,
    almacenPadreId: esGeneral ? null : almacenPadreId || null,
  };
}

export async function crearAlmacenAction(_prevState: AlmacenActionState, formData: FormData): Promise<AlmacenActionState> {
  const parsed = almacenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    // Código único generado por el servidor: nunca lo elige el usuario,
    // igual que el número de un ingreso/traslado/consumo. Ya no es un
    // correlativo global "ALM-0001" — cada categoría tiene su propio
    // correlativo sin ceros a la izquierda (APES1, APES2... AEMP1,
    // AEMP2...), pedido explícito del usuario (2026-11-12). Un sub-almacén
    // (esGeneral=false) no tiene categoría propia: hereda la de su
    // almacén general (almacenPadreId).
    let categoria = parsed.data.categoriaGeneral || null;
    if (!parsed.data.esGeneral && parsed.data.almacenPadreId) {
      const padre = await prisma.almacen.findUnique({
        where: { id: parsed.data.almacenPadreId },
        select: { categoriaGeneral: true },
      });
      categoria = padre?.categoriaGeneral ?? null;
    }
    const prefijo = (categoria && PREFIJO_CODIGO_ALMACEN_POR_CATEGORIA[categoria]) || "ALM-";
    const existentes = await prisma.almacen.findMany({ select: { codigo: true } });
    const codigo = siguienteNumero(existentes.map((a) => a.codigo), prefijo, 1);
    await prisma.almacen.create({ data: { codigo, ...datosAlmacen(parsed.data) } });
  } catch (e) {
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al crear el almacén." };
  }

  revalidatePath("/logistica/almacenes");
  return { success: true };
}

export async function actualizarAlmacenAction(
  id: string,
  _prevState: AlmacenActionState,
  formData: FormData
): Promise<AlmacenActionState> {
  const parsed = almacenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  if (!parsed.data.esGeneral && parsed.data.almacenPadreId === id) {
    return { error: "Un almacén no puede ser su propio almacén general." };
  }

  try {
    await prisma.almacen.update({ where: { id }, data: datosAlmacen(parsed.data) });
  } catch (e) {
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el almacén." };
  }

  revalidatePath("/logistica/almacenes");
  return { success: true };
}
