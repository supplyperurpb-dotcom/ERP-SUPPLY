"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { subirArchivo } from "@/lib/storage";
import { siguienteNumero } from "@/lib/utils";
import { parsearPackingListExcel, type ResultadoParsePL } from "@/lib/comex/importar-pl";

export type AnalisisPackingListResultado =
  | { ok: true; resultado: ResultadoParsePL; hashArchivo: string }
  | { ok: false; error: string };

// Solo lee/valida — no guarda nada. El navegador conserva el mismo archivo
// en memoria para reenviarlo a confirmarImportacionPackingListAction si el
// usuario decide continuar (ver el plan: sin tabla de staging).
export async function analizarPackingListAction(formData: FormData): Promise<AnalisisPackingListResultado> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: "Sesión inválida." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Adjunta un archivo Excel (.xlsx o .xls)." };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  let resultado: ResultadoParsePL;
  try {
    resultado = parsearPackingListExcel(buffer);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  const hashArchivo = createHash("sha256").update(buffer).digest("hex");

  if (resultado.embarque.shipNumber) {
    const existente = await prisma.embarque.findUnique({
      where: { shipNumber: resultado.embarque.shipNumber },
      select: { id: true, numero: true },
    });
    if (existente) {
      resultado.errores.push(`Ya existe un embarque importado con Ship Number "${resultado.embarque.shipNumber}" (${existente.numero}).`);
    }
  }

  const archivoYaImportado = await prisma.embarque.findUnique({ where: { archivoHash: hashArchivo }, select: { numero: true } });
  if (archivoYaImportado) {
    resultado.advertencias.push(`Este mismo archivo ya se importó antes, como ${archivoYaImportado.numero}.`);
  }

  return { ok: true, resultado, hashArchivo };
}

export type ConfirmarImportacionResultado = { error?: string; id?: string };

// Vuelve a parsear el mismo archivo (no confía en la vista previa que ya
// viajó al cliente) y recién acá persiste: sube el Excel a Supabase
// Storage y crea Embarque + EmbarquePallet[] en una sola transacción.
export async function confirmarImportacionPackingListAction(formData: FormData): Promise<ConfirmarImportacionResultado> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión inválida." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Adjunta un archivo Excel (.xlsx o .xls)." };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  let resultado: ResultadoParsePL;
  try {
    resultado = parsearPackingListExcel(buffer);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
  if (resultado.errores.length > 0) {
    return { error: resultado.errores[0] };
  }

  const hashArchivo = createHash("sha256").update(buffer).digest("hex");
  const [porShipNumber, porHash] = await Promise.all([
    prisma.embarque.findUnique({ where: { shipNumber: resultado.embarque.shipNumber }, select: { id: true } }),
    prisma.embarque.findUnique({ where: { archivoHash: hashArchivo }, select: { id: true } }),
  ]);
  if (porShipNumber) return { error: `Ya existe un embarque importado con Ship Number "${resultado.embarque.shipNumber}".` };
  if (porHash) return { error: "Este mismo archivo ya se importó antes." };

  try {
    const existentes = await prisma.embarque.findMany({ select: { numero: true } });
    const numero = siguienteNumero(existentes.map((e) => e.numero), "EMB-");

    // subirArchivo sanea la ruta (espacios, paréntesis, etc. se vuelven
    // "_") y es la ruta REAL donde queda el archivo — hay que guardar lo
    // que devuelve, no la ruta pedida, o después no se encuentra el
    // archivo al generar la URL firmada (bug detectado 2026-11-26: así
    // quedaron mal 74 de 75 embarques ya importados).
    const rutaPedida = `comex/embarques/${resultado.embarque.shipNumber}/${Date.now()}-${archivo.name}`;
    const ruta = await subirArchivo(rutaPedida, archivo);

    const { embarque, pallets } = resultado;
    const creado = await prisma.embarque.create({
      data: {
        numero,
        // Un embarque importado desde el Packing List ya viene con fecha de
        // carga/ETD reales (ya zarpó o está por hacerlo) — no es un
        // PLANIFICADO como el flujo manual, que arranca antes de tener esos
        // datos.
        estado: "EMBARCADO",
        shipNumber: embarque.shipNumber,
        growerCode: embarque.growerCode,
        grower: embarque.grower,
        consignee: embarque.consignee,
        notify: embarque.notify,
        naviera: embarque.naviera,
        vessel: embarque.vessel,
        contenedor: embarque.contenedor,
        blSwb: embarque.blSwb,
        tipoEmbarque: embarque.tipoEmbarque,
        origenPuerto: embarque.origenPuerto,
        destinoPuerto: embarque.destinoPuerto,
        fechaCarga: embarque.fechaCarga,
        etd: embarque.etd,
        eta: embarque.eta,
        totalCasesExcel: embarque.totalCasesExcel,
        totalNetWeightExcel: embarque.totalNetWeightExcel,
        archivoOriginalUrl: ruta,
        archivoOriginalNombre: archivo.name,
        archivoHash: hashArchivo,
        importadoPorId: usuario.id,
        importadoEn: new Date(),
        pallets: {
          create: pallets.map((p) => ({
            palletNumber: p.palletNumber,
            itemFruitCode: p.itemFruitCode,
            descripcionSku: p.descripcionSku,
            variedad: p.variedad,
            label: p.label,
            fruitType: p.fruitType,
            cases: p.cases,
            kgPorSku: p.kgPorSku,
            pesoNetoKg: p.pesoNetoKg,
            thermographRecorder: p.thermographRecorder,
            thermographType: p.thermographType,
            tipoBolsaLiner: p.tipoBolsaLiner,
            atmosferaControlada: p.atmosferaControlada,
            codeDemea: p.codeDemea,
            trazabilityCodeDoc: p.trazabilityCodeDoc,
            lpnDriscolls: p.lpnDriscolls,
            fechaCosecha: p.fechaCosecha,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/comex/importar-pl");
    return { id: creado.id };
  } catch (e) {
    console.error("Error al confirmar importación de Packing List:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}

