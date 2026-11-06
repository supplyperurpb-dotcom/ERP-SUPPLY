"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { subirArchivo } from "@/lib/storage";
import {
  despachoSchema,
  culminarDespachoSchema,
  type DespachoInput,
  type CulminarDespachoInput,
} from "@/lib/validations/despacho";
import { siguienteNumero } from "@/lib/utils";

export type DespachoIQFActionState = { error?: string; success?: boolean; id?: string } | undefined;

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

    const despachoId = await prisma.$transaction(async (tx) => {
      const despacho = await tx.despachoIQF.create({
        data: {
          numero,
          placaCamion: parsed.data.placaCamion,
          conductor: parsed.data.conductor,
          fechaDespacho: parsed.data.fechaDespacho,
          horaDespacho: parsed.data.horaDespacho,
          creadoPorId: usuario?.id,
        },
      });

      await tx.tarjaIQF.updateMany({
        where: { id: { in: parsed.data.tarjaIds } },
        data: { despachoId: despacho.id },
      });

      return despacho.id;
    });

    revalidatePath("/acopio/despacho-iqf");
    revalidatePath("/acopio/tarjas-iqf");
    return { success: true, id: despachoId };
  } catch (e) {
    console.error("Error inesperado en crearDespachoIQFAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el despacho." };
  }
}

const TIPOS_GUIA_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

// Sube la foto/escaneo/PDF de la guía de remisión real, para "Culminar
// proceso" en el Packing List Industrial Acopio — mismo criterio que
// subirGuiaRemisionDespachoAction en lib/actions/despacho-actions.ts.
export async function subirGuiaRemisionDespachoIQFAction(formData: FormData): Promise<{ path?: string; error?: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo." };
  }
  if (!TIPOS_GUIA_PERMITIDOS.includes(archivo.type)) {
    return { error: "Formato no permitido. Sube una foto (JPG/PNG/HEIC) o un PDF." };
  }
  if (archivo.size > 10 * 1024 * 1024) {
    return { error: "El archivo no puede superar 10 MB." };
  }

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión." };

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "bin";
  const ruta = `despachos-iqf/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  try {
    const path = await subirArchivo(ruta, archivo);
    return { path };
  } catch (e) {
    console.error("Error subiendo guía de remisión de despacho IQF:", e);
    return { error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }
}

export type CulminarDespachoIQFActionState = { error?: string; success?: boolean } | undefined;

// "Culminar proceso": exige guía de remisión (número + adjunto) ya
// subidos y pasa el despacho IQF de BORRADOR a CULMINADO. Mismo criterio
// que culminarDespachoAction en lib/actions/despacho-actions.ts.
export async function culminarDespachoIQFAction(
  id: string,
  data: CulminarDespachoInput
): Promise<CulminarDespachoIQFActionState> {
  const parsed = culminarDespachoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const despacho = await prisma.despachoIQF.findUnique({ where: { id }, select: { estado: true } });
  if (!despacho) {
    return { error: "El despacho ya no existe. Actualiza la página e intenta de nuevo." };
  }
  if (despacho.estado === "CULMINADO") {
    return { success: true };
  }

  await prisma.despachoIQF.update({
    where: { id },
    data: {
      numeroGuiaRemision: parsed.data.numeroGuiaRemision,
      guiaRemisionArchivo: parsed.data.guiaRemisionArchivo,
      estado: "CULMINADO",
      culminadoEn: new Date(),
    },
  });

  revalidatePath(`/acopio/despacho-iqf/${id}`);
  revalidatePath("/acopio/despacho-iqf");
  return { success: true };
}
