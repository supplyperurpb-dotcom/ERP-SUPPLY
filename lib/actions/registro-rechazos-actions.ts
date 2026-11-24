"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { subirArchivo } from "@/lib/storage";
import {
  parsearTextoRechazoEmail,
  normalizarShipNumber,
  categoriaDesdeDisposicion,
  type LpnExtraido,
} from "@/lib/comex/registro-rechazos";
import type { CategoriaRechazo } from "@prisma/client";

export type LineaRechazoAnalizada = {
  lpn: string;
  ranch: string | null;
  variedad: string | null;
  cajasRechazadas: number;
  itemCode: string | null;
  descripcionSku: string | null;
  disposicionSugerida: string | null;
  categoriaSugerida: CategoriaRechazo;
  embarquePalletId: string | null;
  palletNumber: string | null;
  variedadPL: string | null;
  cajasOriginales: number | null;
  alertaLpnNoEncontrado: boolean;
  alertaVariedadNoCoincide: boolean;
  alertaExcedeOriginales: boolean;
};

export type AnalisisRechazoOk = {
  ok: true;
  embarqueId: string | null;
  embarqueNumero: string | null;
  shipNumber: string | null;
  asuntoCorreo: string | null;
  remitente: string | null;
  fechaCorreo: Date | null;
  totalPalletsCorreo: number | null;
  totalCajasRechazadasCorreo: number | null;
  lineas: LineaRechazoAnalizada[];
  advertencias: string[];
  hashArchivo: string;
};
export type AnalisisRechazoResultado = AnalisisRechazoOk | { ok: false; error: string };

// Cruza cada LPN extraído del correo contra EmbarquePallet — el LPN NO es
// único (confirmado contra datos reales: puede repetirse en más de una
// fila del mismo pallet, partido en sub-lotes), por eso "cajasOriginales"
// suma TODAS las filas con ese LPN en vez de asumir una sola.
async function cruzarConPackingList(items: LpnExtraido[]): Promise<{ lineas: LineaRechazoAnalizada[]; embarqueId: string | null }> {
  const lineas: LineaRechazoAnalizada[] = [];
  let embarqueIdResuelto: string | null = null;

  for (const item of items) {
    const filas = await prisma.embarquePallet.findMany({
      where: { lpnDriscolls: item.lpn },
      select: { id: true, palletNumber: true, variedad: true, cases: true, embarqueId: true },
    });

    const categoriaSugerida = categoriaDesdeDisposicion(item.disposicionSugerida);

    if (filas.length === 0) {
      lineas.push({
        lpn: item.lpn,
        ranch: item.ranch,
        variedad: item.variedad,
        cajasRechazadas: item.cajasRechazadas,
        itemCode: item.itemCode,
        descripcionSku: item.descripcionSku,
        disposicionSugerida: item.disposicionSugerida,
        categoriaSugerida,
        embarquePalletId: null,
        palletNumber: null,
        variedadPL: null,
        cajasOriginales: null,
        alertaLpnNoEncontrado: true,
        alertaVariedadNoCoincide: false,
        alertaExcedeOriginales: false,
      });
      continue;
    }

    const cajasOriginales = filas.reduce((acc, f) => acc + f.cases, 0);
    const primera = filas[0];
    if (!embarqueIdResuelto) embarqueIdResuelto = primera.embarqueId;

    const variedadNoCoincide = !!item.variedad && primera.variedad.toLowerCase() !== item.variedad.toLowerCase();

    lineas.push({
      lpn: item.lpn,
      ranch: item.ranch,
      variedad: item.variedad,
      cajasRechazadas: item.cajasRechazadas,
      itemCode: item.itemCode,
      descripcionSku: item.descripcionSku,
      disposicionSugerida: item.disposicionSugerida,
      categoriaSugerida,
      embarquePalletId: primera.id,
      palletNumber: primera.palletNumber,
      variedadPL: primera.variedad,
      cajasOriginales,
      alertaLpnNoEncontrado: false,
      alertaVariedadNoCoincide: variedadNoCoincide,
      alertaExcedeOriginales: item.cajasRechazadas > cajasOriginales,
    });
  }

  return { lineas, embarqueId: embarqueIdResuelto };
}

// Solo lee/valida — no guarda nada. El navegador ya corrió el OCR (ver
// registro-rechazo-form.tsx) y manda acá el texto extraído + el archivo
// (para el hash de duplicado), igual filosofía que analizarPackingListAction.
export async function analizarRechazoAction(formData: FormData): Promise<AnalisisRechazoResultado> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: "Sesión inválida." };

  const textoOcr = formData.get("textoOcr");
  const archivo = formData.get("archivo");
  if (typeof textoOcr !== "string" || !textoOcr.trim()) {
    return { ok: false, error: "No se pudo leer texto de la imagen (OCR vacío)." };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Adjunta la captura del correo." };
  }

  const parseado = parsearTextoRechazoEmail(textoOcr);
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const hashArchivo = createHash("sha256").update(buffer).digest("hex");

  const advertencias = [...parseado.advertencias];
  const yaImportado = await prisma.rechazoCorreo.findUnique({ where: { archivoHash: hashArchivo }, select: { id: true } });
  if (yaImportado) advertencias.push("Este mismo correo ya se importó antes (misma imagen).");

  const { lineas, embarqueId } = await cruzarConPackingList(parseado.items);

  let embarqueResuelto: { id: string; numero: string } | null = null;
  if (embarqueId) {
    embarqueResuelto = await prisma.embarque.findUnique({ where: { id: embarqueId }, select: { id: true, numero: true } });
  } else if (parseado.shipNumber) {
    // Ningún LPN matcheó — se intenta igual por Ship Number, normalizando
    // espacios (el mismo embarque puede traer o no un espacio según de
    // dónde salga el número, ej. "DEPE026-1865" vs "DEPE026- 2201").
    const candidatos = await prisma.embarque.findMany({ where: { shipNumber: { not: null } }, select: { id: true, numero: true, shipNumber: true } });
    const normalizado = normalizarShipNumber(parseado.shipNumber);
    const match = candidatos.find((c) => c.shipNumber && normalizarShipNumber(c.shipNumber) === normalizado);
    if (match) embarqueResuelto = { id: match.id, numero: match.numero };
  }
  if (!embarqueResuelto) advertencias.push("No se encontró ningún embarque importado que corresponda a este correo.");

  return {
    ok: true,
    embarqueId: embarqueResuelto?.id ?? null,
    embarqueNumero: embarqueResuelto?.numero ?? null,
    shipNumber: parseado.shipNumber,
    asuntoCorreo: parseado.asuntoCorreo,
    remitente: parseado.remitente,
    fechaCorreo: parseado.fechaCorreo,
    totalPalletsCorreo: parseado.totalPalletsCorreo,
    totalCajasRechazadasCorreo: parseado.totalCajasRechazadasCorreo,
    lineas,
    advertencias,
    hashArchivo,
  };
}

export type EncabezadoRechazoEditable = {
  asuntoCorreo: string | null;
  remitente: string | null;
  fechaCorreo: Date | null;
  poNumber: string | null;
  totalPalletsCorreo: number | null;
  totalCajasRechazadasCorreo: number | null;
};

export type ConfirmarRechazoResultado = { error?: string; id?: string };

// A diferencia de analizarRechazoAction, ACÁ SÍ se respetan los campos que
// el usuario haya editado a mano en la vista previa (pedido explícito:
// "permitir editar los campos extraídos antes de confirmar") — no se
// pisan con un reparseo ciego del texto. Lo único que se recalcula es el
// hash del archivo (duplicado) y el embarque asociado, a partir del
// EmbarquePallet que haya quedado linkeado en cada línea.
export async function confirmarRegistroRechazoAction(
  formData: FormData,
  encabezado: EncabezadoRechazoEditable,
  lineasEditadas: LineaRechazoAnalizada[]
): Promise<ConfirmarRechazoResultado> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión inválida." };

  const textoOcr = formData.get("textoOcr");
  const archivo = formData.get("archivo");
  if (typeof textoOcr !== "string" || !textoOcr.trim()) return { error: "No se pudo leer texto de la imagen (OCR vacío)." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Adjunta la captura del correo." };

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const hashArchivo = createHash("sha256").update(buffer).digest("hex");

  const yaImportado = await prisma.rechazoCorreo.findUnique({ where: { archivoHash: hashArchivo } });
  if (yaImportado) return { error: "Este mismo correo ya se importó antes." };

  if (lineasEditadas.length === 0) return { error: "No hay líneas para registrar." };

  try {
    const primerPalletId = lineasEditadas.find((l) => l.embarquePalletId)?.embarquePalletId ?? null;
    const palletResuelto = primerPalletId
      ? await prisma.embarquePallet.findUnique({ where: { id: primerPalletId }, select: { embarqueId: true } })
      : null;
    const embarqueId = palletResuelto?.embarqueId ?? null;

    const ruta = `comex/rechazos/${encabezado.poNumber ?? "sin-ship-number"}/${Date.now()}-${archivo.name}`;
    await subirArchivo(ruta, archivo);

    const creado = await prisma.rechazoCorreo.create({
      data: {
        embarqueId,
        poNumber: encabezado.poNumber,
        asuntoCorreo: encabezado.asuntoCorreo,
        remitente: encabezado.remitente,
        fechaCorreo: encabezado.fechaCorreo,
        archivoOriginalUrl: ruta,
        archivoOriginalNombre: archivo.name,
        archivoHash: hashArchivo,
        textoExtraido: textoOcr,
        totalPalletsCorreo: encabezado.totalPalletsCorreo,
        totalCajasRechazadasCorreo: encabezado.totalCajasRechazadasCorreo,
        creadoPorId: usuario.id,
        items: {
          create: lineasEditadas.map((l) => ({
            embarquePalletId: l.embarquePalletId,
            lpn: l.lpn,
            itemCode: l.itemCode,
            descripcionSku: l.descripcionSku,
            variedad: l.variedad,
            cajasOriginales: l.cajasOriginales,
            cajasRechazadas: l.cajasRechazadas,
            disposicionSugerida: l.disposicionSugerida,
            categoriaSugerida: l.categoriaSugerida,
            alertaLpnNoEncontrado: l.alertaLpnNoEncontrado,
            alertaVariedadNoCoincide: l.alertaVariedadNoCoincide,
            alertaExcedeOriginales: l.alertaExcedeOriginales,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/comex/registro-rechazos");
    revalidatePath("/comex/consulta-rechazos");
    return { id: creado.id };
  } catch (e) {
    console.error("Error al confirmar registro de rechazo:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}

// Confirma o cambia la clasificación final / estado de una línea de
// rechazo ya registrada (punto 5 del pedido: disposición sugerida ≠
// disposición final, esta última se fija después, a propósito).
export async function actualizarLineaRechazoAction(
  id: string,
  datos: { categoriaFinal?: CategoriaRechazo | null; estado?: "PENDIENTE" | "CONFIRMADO" | "ANULADO" | "DISPUTADO"; motivoRechazo?: string }
): Promise<{ error?: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión inválida." };

  try {
    await prisma.rechazoItem.update({ where: { id }, data: datos });
    revalidatePath("/comex/consulta-rechazos");
    revalidatePath("/comex/resumen-liquidaciones");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo actualizar la línea." };
  }
}
