"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { subirArchivo } from "@/lib/storage";
import { parsearFacturacionHistoricaExcel, type FilaHistoricaParseada } from "@/lib/comex/importar-facturacion-historica";
import { normalizarShipNumber } from "@/lib/comex/registro-rechazos";

export type AnalisisFacturacionHistorica = {
  ok: true;
  nombreHoja: string;
  totalFilasLeidas: number;
  totalFilas: number;
  poDistintos: number;
  filasConError: number;
  yaImportadoEsteArchivo: boolean;
  existeMigracionPrevia: boolean;
  hashArchivo: string;
};
export type ResultadoAnalisisFacturacionHistorica = AnalisisFacturacionHistorica | { ok: false; error: string };

// Solo lee/valida — no guarda nada (igual filosofía que analizarPackingListAction
// y analizarRechazoAction). Verifica si este archivo exacto ya se importó, y
// si ya existe CUALQUIER migración histórica completada (para decidir si hace
// falta la confirmación administrativa de re-migración en el siguiente paso).
export async function analizarFacturacionHistoricaAction(formData: FormData): Promise<ResultadoAnalisisFacturacionHistorica> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: "Sesión inválida." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Adjunta el archivo Excel de Facturación." };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const hashArchivo = createHash("sha256").update(buffer).digest("hex");

  let resultado;
  try {
    resultado = parsearFacturacionHistoricaExcel(buffer);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
  if (resultado.errores.length > 0) return { ok: false, error: resultado.errores.join(" ") };

  const [yaImportadoEsteArchivo, existeMigracionPrevia] = await Promise.all([
    prisma.importHistory.findUnique({ where: { archivoHash: hashArchivo }, select: { id: true } }),
    prisma.importHistory.findFirst({
      where: { tipo: "FACTURACION_HISTORICA", estado: "COMPLETADO" },
      select: { id: true },
    }),
  ]);

  const poDistintos = new Set(resultado.filas.map((f) => f.po)).size;
  const filasConError = resultado.filas.filter((f) => f.camposConError.length > 0).length;

  return {
    ok: true,
    nombreHoja: resultado.nombreHoja,
    totalFilasLeidas: resultado.totalFilasLeidas,
    totalFilas: resultado.filas.length,
    poDistintos,
    filasConError,
    yaImportadoEsteArchivo: !!yaImportadoEsteArchivo,
    existeMigracionPrevia: !!existeMigracionPrevia,
    hashArchivo,
  };
}

// Enlace automático por PO↔Embarque.shipNumber/numero normalizado — mismo
// patrón que RechazoCorreo.embarqueId en Registro de Rechazos. Si no hay
// match confiable, queda sin vincular (se puede vincular a mano después).
async function resolverEmbarquePorPo(filas: FilaHistoricaParseada[]): Promise<Map<string, string>> {
  const embarques = await prisma.embarque.findMany({ select: { id: true, shipNumber: true, numero: true } });
  const porClaveNormalizada = new Map<string, string>();
  for (const e of embarques) {
    if (e.shipNumber) porClaveNormalizada.set(normalizarShipNumber(e.shipNumber), e.id);
    porClaveNormalizada.set(normalizarShipNumber(e.numero), e.id);
  }
  const resultado = new Map<string, string>();
  for (const f of filas) {
    const embarqueId = porClaveNormalizada.get(normalizarShipNumber(f.po));
    if (embarqueId) resultado.set(f.po, embarqueId);
  }
  return resultado;
}

export type ConfirmarFacturacionHistoricaResultado = {
  error?: string;
  importHistoryId?: string;
  registrosImportados?: number;
  registrosVinculadosAEmbarque?: number;
};

// Confirma la migración histórica — control "ya se migró" (pedido
// explícito, Fase 2): si ya existe una migración FACTURACION_HISTORICA
// COMPLETADA y no viene `confirmarReMigracion: true`, se bloquea con un
// mensaje explícito. El mismo archivo (mismo hash) NUNCA se puede volver
// a importar, con o sin esa confirmación (evita duplicar los mismos 429
// registros por error). Nunca se borran migraciones anteriores.
export async function confirmarFacturacionHistoricaAction(
  formData: FormData,
  confirmarReMigracion: boolean
): Promise<ConfirmarFacturacionHistoricaResultado> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión inválida." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Adjunta el archivo Excel de Facturación." };

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const hashArchivo = createHash("sha256").update(buffer).digest("hex");

  const yaImportado = await prisma.importHistory.findUnique({ where: { archivoHash: hashArchivo } });
  if (yaImportado) return { error: "Este mismo archivo ya se importó antes (mismo contenido)." };

  const migracionPrevia = await prisma.importHistory.findFirst({
    where: { tipo: "FACTURACION_HISTORICA", estado: "COMPLETADO" },
  });
  if (migracionPrevia && !confirmarReMigracion) {
    return {
      error:
        "Ya existe una migración histórica de Facturación completada. Repetirla requiere confirmación administrativa explícita.",
    };
  }

  let resultado;
  try {
    resultado = parsearFacturacionHistoricaExcel(buffer);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
  if (resultado.errores.length > 0) return { error: resultado.errores.join(" ") };
  if (resultado.filas.length === 0) return { error: "El archivo no tiene filas de datos válidas." };

  try {
    const embarquePorPo = await resolverEmbarquePorPo(resultado.filas);
    const ruta = `comex/facturacion-historica/${Date.now()}-${archivo.name}`;
    const archivoUrl = await subirArchivo(ruta, archivo);

    const importHistoryId = await prisma.$transaction(async (tx) => {
      const importHistory = await tx.importHistory.create({
        data: {
          tipo: "FACTURACION_HISTORICA",
          archivoNombre: archivo.name,
          archivoUrl,
          archivoHash: hashArchivo,
          registros: resultado.filas.length,
          estado: "COMPLETADO",
          errores: [],
          ejecutadoPorId: usuario.id,
        },
      });

      await tx.historicalBilling.createMany({
        data: resultado.filas.map((f) => {
          const embarqueId = embarquePorPo.get(f.po) ?? null;
          return {
            sourceFile: archivo.name,
            sourceRowNumber: f.sourceRowNumber,
            importHistoryId: importHistory.id,
            dispatchDate: f.dispatchDate,
            dispWeek: f.dispWeek,
            customer: f.customer,
            market: f.market,
            originPort: f.originPort,
            destinationCountry: f.destinationCountry,
            format: f.format,
            po: f.po,
            transportMode: f.transportMode,
            weekEta: f.weekEta,
            weekAta: f.weekAta,
            statusEmbarque: f.statusEmbarque,
            settlementStatus: f.settlementStatus,
            variety: f.variety,
            type: f.type,
            label: f.label,
            destino: f.destino,
            totalFob: f.totalFob,
            invoicedAmount: f.invoicedAmount,
            cifLiquidatedTariffs: f.cifLiquidatedTariffs,
            netWeight: f.netWeight,
            netKilosLiquidated: f.netKilosLiquidated,
            datosOriginales: f.datosOriginales,
            camposConError: f.camposConError,
            embarqueId,
            embarqueVinculadoPor: embarqueId ? "AUTOMATICO" : null,
          };
        }),
      });

      return importHistory.id;
    });

    revalidatePath("/comex/importar-facturacion-historica");
    revalidatePath("/comex/dashboard-exportaciones-prueba");
    revalidatePath("/comex/conciliacion-excel-supabase");

    const registrosVinculadosAEmbarque = resultado.filas.filter((f) => embarquePorPo.has(f.po)).length;
    return { importHistoryId, registrosImportados: resultado.filas.length, registrosVinculadosAEmbarque };
  } catch (e) {
    console.error("Error al confirmar migración histórica de Facturación:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar." };
  }
}
