"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { TIPOS_AGROQUIMICO, prefijoSubfamilia, type TipoAgroquimicoCodigo } from "@/lib/constants/sku";
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
// Suministros: SU + correlativo de 6 dígitos, no depende de la subfamilia.
// La versión "no valorada" (NV) ya no se crea aquí — ver
// crearSkusNoValoradosAction, que la genera a partir de un SKU existente.
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
// Agroquímicos, Fertilizantes y Ósmosis: AG/FE/OS según el tipo + 2 letras
// de la subfamilia + correlativo de 4 dígitos (p. ej. AGFO0001, FEBE0002).
// Una serie independiente por combinación tipo+subfamilia — ver
// prefijoSubfamilia en lib/constants/sku.ts. La versión "no valorada" (NV)
// ya no se crea aquí — ver crearSkusNoValoradosAction, que la genera a
// partir de un SKU existente.
// ---------------------------------------------------------------------
export async function crearSkuAgroquimicoAction(data: SkuAgroquimicoInput): Promise<SkuCreacionState> {
  const parsed = skuAgroquimicoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tipo, subfamilia, producto, activo, clasificacion, unidadMedida, stockMinimo } = parsed.data;

  const tipoInfo = TIPOS_AGROQUIMICO.find((t) => t.valor === (tipo as TipoAgroquimicoCodigo));
  if (!tipoInfo) return { error: "Tipo inválido." };

  // El nombre del producto sale solo de "Producto"; activo/clasificación son
  // solo para clasificar, no forman parte del nombre.
  const descripcion = producto.trim();

  const prefijo = `${tipoInfo.prefijo}${prefijoSubfamilia(subfamilia)}`;

  try {
    const usuario = await getUsuarioActual();

    const nuevoSku = await prisma.$transaction(async (tx) => {
      const existentes = await tx.sku.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } });
      const codigo = siguienteNumero(existentes.map((s) => s.codigo), prefijo, 4);

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
// no depende de la subfamilia. El SKU es solo para agrupar (un SKU por
// subfamilia, p. ej. "Apicultura"): no se permite crear dos para la misma.
// ---------------------------------------------------------------------
export async function crearSkuServicioAction(data: SkuServicioInput): Promise<SkuCreacionState> {
  const parsed = skuServicioSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { subfamilia, unidadMedida } = parsed.data;

  const descripcion = subfamilia;
  const prefijo = "SERV";

  try {
    const existente = await prisma.sku.findFirst({
      where: { categoria: "Servicios", subfamilia: { equals: subfamilia, mode: "insensitive" } },
    });
    if (existente) {
      return { error: `Ya existe un SKU para "${subfamilia}": ${existente.codigo}. Úsalo al registrar la solicitud.` };
    }

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

export type CrearSkusNoValoradosState = { error?: string; creados?: number; omitidos?: string[] } | undefined;

// ---------------------------------------------------------------------
// Crear la versión "no valorada" de uno o más SKU ya existentes: el mismo
// código, con "NV" antepuesto (p. ej. AGFO0001 -> NVAGFO0001), sin pasar
// por el correlativo propio de "no valorado" que usan los formularios de
// creación manual — ver CrearSkuNoValoradoDialog.
// ---------------------------------------------------------------------
export async function crearSkusNoValoradosAction(ids: string[]): Promise<CrearSkusNoValoradosState> {
  if (ids.length === 0) {
    return { error: "Selecciona al menos un código." };
  }

  const usuario = await getUsuarioActual();
  const base = await prisma.sku.findMany({ where: { id: { in: ids } } });

  let creados = 0;
  const omitidos: string[] = [];

  for (const sku of base) {
    if (sku.codigo.startsWith("NV")) {
      omitidos.push(`${sku.codigo} (ya es no valorado)`);
      continue;
    }
    if (sku.categoria === "Servicios") {
      omitidos.push(`${sku.codigo} (los servicios no tienen versión no valorada)`);
      continue;
    }

    const nuevoCodigo = `NV${sku.codigo}`;
    const existe = await prisma.sku.findUnique({ where: { codigo: nuevoCodigo } });
    if (existe) {
      omitidos.push(`${sku.codigo} (ya existe ${nuevoCodigo})`);
      continue;
    }

    const descripcionBase = sku.descripcion.replace(/\s+NV$/i, "").trim();
    await prisma.sku.create({
      data: {
        codigo: nuevoCodigo,
        descripcion: `${descripcionBase} NV`.toUpperCase(),
        categoria: sku.categoria,
        subfamilia: sku.subfamilia,
        unidadMedida: sku.unidadMedida,
        stockMinimo: sku.stockMinimo,
        creadoPorId: usuario?.id,
      },
    });
    creados++;
  }

  revalidatePath("/logistica/sku");
  return { creados, omitidos: omitidos.length > 0 ? omitidos : undefined };
}

// Editar o eliminar un SKU (de cualquier categoría: Agroquímicos,
// Fertilizantes, Ósmosis, Suministros o Servicios) es solo para
// administradores; el resto de usuarios solo puede crear SKU nuevos.
export async function actualizarSkuAction(
  id: string,
  _prevState: SkuActionState,
  formData: FormData
): Promise<SkuActionState> {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede editar un SKU." };
  }

  const parsed = skuSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.sku.update({ where: { id }, data: parsed.data });

  revalidatePath("/logistica/sku");
  return { success: true };
}

export async function eliminarSkuAction(id: string): Promise<{ error?: string } | undefined> {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede eliminar un SKU." };
  }

  await prisma.sku.delete({ where: { id } });
  revalidatePath("/logistica/sku");
  return undefined;
}
