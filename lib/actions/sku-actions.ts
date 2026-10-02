"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { TIPOS_AGROQUIMICO, type TipoAgroquimicoCodigo } from "@/lib/constants/sku";
import {
  skuSchema,
  skuSuministroSchema,
  skuAgroquimicoSchema,
  skuServicioSchema,
  type SkuSuministroInput,
  type SkuAgroquimicoInput,
  type SkuServicioInput,
} from "@/lib/validations/sku";

export type SkuActionState = { error?: string; success?: boolean } | undefined;
export type SkuCreacionState = { error?: string; id?: string; codigo?: string } | undefined;

// ---------------------------------------------------------------------
// Suministros: SU + correlativo de 6 dígitos. Una sola serie para toda la
// categoría, no depende de la subfamilia.
// ---------------------------------------------------------------------
export async function crearSkuSuministroAction(data: SkuSuministroInput): Promise<SkuCreacionState> {
  const parsed = skuSuministroSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { subfamilia, producto, material, marca, medida, destinoDescripcion, codigoParte, color, presentacion, unidadMedida, stockMinimo } =
    parsed.data;

  const descripcion = [producto, material, marca, medida, destinoDescripcion, codigoParte, color, presentacion]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v)
    .join(" ");

  const prefijo = "SU";

  try {
    const usuario = await getUsuarioActual();

    const nuevoSku = await prisma.$transaction(async (tx) => {
      const existentes = await tx.sku.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } });
      const codigo = siguienteNumero(existentes.map((s) => s.codigo), prefijo, 6);

      return tx.sku.create({
        data: {
          codigo,
          descripcion,
          categoria: "Suministros",
          subfamilia,
          unidadMedida,
          stockMinimo: stockMinimo ?? null,
          creadoPorId: usuario?.id,
        },
      });
    });

    revalidatePath("/logistica/sku");
    return { id: nuevoSku.id, codigo: nuevoSku.codigo };
  } catch (e) {
    console.error("Error inesperado en crearSkuSuministroAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al crear el SKU." };
  }
}

// ---------------------------------------------------------------------
// Agroquímicos, Fertilizantes y Ósmosis: (NV si no valorado) + AG/FE/OS
// según el tipo + correlativo de 6 dígitos. Una sola serie por tipo (no
// depende de la subfamilia); "NV" lleva su propia serie, independiente de
// la versión valorada del mismo tipo.
// ---------------------------------------------------------------------
export async function crearSkuAgroquimicoAction(data: SkuAgroquimicoInput): Promise<SkuCreacionState> {
  const parsed = skuAgroquimicoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tipo, subfamilia, producto, activo, clasificacion, noValorado, unidadMedida, stockMinimo } = parsed.data;

  const tipoInfo = TIPOS_AGROQUIMICO.find((t) => t.valor === (tipo as TipoAgroquimicoCodigo));
  if (!tipoInfo) return { error: "Tipo inválido." };

  const descripcion = [producto, activo, clasificacion]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v)
    .join(" ");

  const prefijo = `${noValorado ? "NV" : ""}${tipoInfo.prefijo}`;

  try {
    const usuario = await getUsuarioActual();

    const nuevoSku = await prisma.$transaction(async (tx) => {
      const existentes = await tx.sku.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } });
      const codigo = siguienteNumero(existentes.map((s) => s.codigo), prefijo, 6);

      return tx.sku.create({
        data: {
          codigo,
          descripcion,
          categoria: "Agroquímicos, Fertilizantes y Ósmosis",
          subfamilia,
          unidadMedida,
          stockMinimo: stockMinimo ?? null,
          creadoPorId: usuario?.id,
        },
      });
    });

    revalidatePath("/logistica/sku");
    return { id: nuevoSku.id, codigo: nuevoSku.codigo };
  } catch (e) {
    console.error("Error inesperado en crearSkuAgroquimicoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al crear el SKU." };
  }
}

// ---------------------------------------------------------------------
// Servicios: SERV + correlativo. Una sola serie para toda la categoría,
// no depende de la subfamilia.
// ---------------------------------------------------------------------
export async function crearSkuServicioAction(data: SkuServicioInput): Promise<SkuCreacionState> {
  const parsed = skuServicioSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { subfamilia, comentario, unidadMedida } = parsed.data;

  const descripcion = comentario?.trim() ? `${subfamilia} - ${comentario.trim()}` : subfamilia;
  const prefijo = "SERV";

  try {
    const usuario = await getUsuarioActual();

    const nuevoSku = await prisma.$transaction(async (tx) => {
      const existentes = await tx.sku.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } });
      const codigo = siguienteNumero(existentes.map((s) => s.codigo), prefijo, 4);

      return tx.sku.create({
        data: {
          codigo,
          descripcion,
          categoria: "Servicios",
          subfamilia,
          unidadMedida,
          creadoPorId: usuario?.id,
        },
      });
    });

    revalidatePath("/logistica/sku");
    return { id: nuevoSku.id, codigo: nuevoSku.codigo };
  } catch (e) {
    console.error("Error inesperado en crearSkuServicioAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al crear el SKU." };
  }
}

export async function actualizarSkuAction(
  id: string,
  _prevState: SkuActionState,
  formData: FormData
): Promise<SkuActionState> {
  const parsed = skuSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.sku.update({ where: { id }, data: parsed.data });

  revalidatePath("/logistica/sku");
  return { success: true };
}

export async function eliminarSkuAction(id: string) {
  await prisma.sku.delete({ where: { id } });
  revalidatePath("/logistica/sku");
}
