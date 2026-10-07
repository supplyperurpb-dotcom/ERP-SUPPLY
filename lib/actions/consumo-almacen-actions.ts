"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { costosParaValidacion } from "@/lib/stock-almacen";
import { subirArchivo } from "@/lib/storage";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";

export type ConsumoAlmacenActionState = { error?: string; id?: string } | undefined;

const TIPOS_FOTO_PERMITIDOS = ["image/jpeg", "image/png"];

// El combobox del formulario ya solo ofrece retiradores con permiso en el
// almacén elegido, pero nunca se confía en lo que mande el cliente: se
// vuelve a verificar acá que el DNI recibido sea un RetiradorAutorizado
// activo y con ese almacén en su lista de permitidos.
async function verificarRetiradorAutorizado(dni: string, almacenId: string): Promise<{ error?: string }> {
  const retirador = await prisma.retiradorAutorizado.findUnique({
    where: { dni },
    include: { almacenesPermitidos: true },
  });
  if (!retirador || !retirador.activo) {
    return { error: "Esa persona no está en la lista de retiradores autorizados." };
  }
  if (!retirador.almacenesPermitidos.some((p) => p.almacenId === almacenId)) {
    return { error: `${retirador.nombres} ${retirador.apellidos} no tiene permiso de retirar de este almacén.` };
  }
  return {};
}

// Sube la firma táctil (siempre PNG, capturada en un <canvas>) antes de
// registrar el consumo — mismo patrón de "subir primero, recién con la
// ruta llamar a la action de crear" que subirGuiaRemisionIngresoAction.
export async function subirFirmaConsumoAction(formData: FormData): Promise<{ path?: string; error?: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Captura la firma." };
  }
  if (archivo.type !== "image/png") {
    return { error: "La firma debe subirse como imagen PNG." };
  }

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión." };

  const ruta = `consumos-almacen/firmas/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
  try {
    const path = await subirArchivo(ruta, archivo);
    return { path };
  } catch (e) {
    console.error("Error subiendo firma de consumo:", e);
    return { error: e instanceof Error ? e.message : "No se pudo subir la firma." };
  }
}

// Sube la foto de evidencia del despacho. Se restringe a JPG/PNG (no HEIC)
// a propósito: el PDF del consumo la incrusta directamente y pdf-lib solo
// puede incrustar esos dos formatos.
export async function subirEvidenciaConsumoAction(formData: FormData): Promise<{ path?: string; error?: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona una foto." };
  }
  if (!TIPOS_FOTO_PERMITIDOS.includes(archivo.type)) {
    return { error: "Formato no permitido. Sube una foto en JPG o PNG." };
  }
  if (archivo.size > 10 * 1024 * 1024) {
    return { error: "El archivo no puede superar 10 MB." };
  }

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión." };

  const extension = archivo.type === "image/png" ? "png" : "jpg";
  const ruta = `consumos-almacen/evidencias/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  try {
    const path = await subirArchivo(ruta, archivo);
    return { path };
  } catch (e) {
    console.error("Error subiendo evidencia de despacho:", e);
    return { error: e instanceof Error ? e.message : "No se pudo subir la foto." };
  }
}

export async function crearConsumoAlmacenAction(data: ConsumoAlmacenInput): Promise<ConsumoAlmacenActionState> {
  const parsed = consumoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, horaRetiro, almacenOrigenId, retiradoPor, retiradoPorDni, firmaArchivo, fotoEvidenciaArchivo, observaciones, items } =
    parsed.data;

  const almacen = await prisma.almacen.findUnique({ where: { id: almacenOrigenId } });
  if (!almacen) {
    return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const permiso = await verificarRetiradorAutorizado(retiradoPorDni, almacenOrigenId);
  if (permiso.error) return permiso;

  const cantidadPorSku = new Map<string, number>();
  for (const item of items) {
    cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
  }

  const costosOrigen = await costosParaValidacion(almacenOrigenId);
  const precioPorSku = new Map<string, number>();
  for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
    const costo = costosOrigen.get(skuId);
    const disponible = costo?.cantidad ?? 0;
    if (cantidadSolicitada > disponible) {
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
      return {
        error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
      };
    }
    if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
      const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
      return {
        error: `No hay ingresos ni traslados con costo registrados de ${sku?.codigo ?? skuId} en ${almacen.nombre}, así que no se puede calcular su precio unitario ponderado.`,
      };
    }
    precioPorSku.set(skuId, costo.precioUnitarioPonderado);
  }

  try {
    const usuario = await getUsuarioActual();

    const nuevoConsumo = await prisma.$transaction(async (tx) => {
      const existentes = await tx.consumoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((c) => c.numero), "CA-");

      const consumo = await tx.consumoAlmacen.create({
        data: {
          numero,
          fecha,
          horaRetiro,
          almacenOrigenId,
          retiradoPor,
          retiradoPorDni,
          firmaArchivo,
          fotoEvidenciaArchivo,
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of items) {
        const precioUnitarioPonderadoValor = precioPorSku.get(item.skuId)!;
        const valorConsumido = item.cantidad * precioUnitarioPonderadoValor;

        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: consumo.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: precioUnitarioPonderadoValor,
            valorConsumido,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenOrigenId,
            tipo: "SALIDA",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "CONSUMO_ALMACEN",
            documentoOrigenId: consumo.id,
            fecha,
            observaciones: observaciones || null,
            creadoPorId: usuario?.id,
          },
        });
      }

      return consumo;
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenOrigenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    return { id: nuevoConsumo.id };
  } catch (e) {
    console.error("Error inesperado en crearConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el consumo." };
  }
}

export async function actualizarConsumoAlmacenAction(
  id: string,
  data: ConsumoAlmacenInput
): Promise<ConsumoAlmacenActionState> {
  const parsed = consumoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, horaRetiro, almacenOrigenId, retiradoPor, retiradoPorDni, firmaArchivo, fotoEvidenciaArchivo, observaciones, items } =
    parsed.data;

  const almacen = await prisma.almacen.findUnique({ where: { id: almacenOrigenId } });
  if (!almacen) {
    return { error: "El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const permiso = await verificarRetiradorAutorizado(retiradoPorDni, almacenOrigenId);
  if (permiso.error) return permiso;

  const cantidadPorSku = new Map<string, number>();
  for (const item of items) {
    cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
  }

  try {
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      const existente = await tx.consumoAlmacen.findUnique({ where: { id } });
      if (!existente) throw new Error("El consumo ya no existe. Actualiza la página e intenta de nuevo.");

      // Se borran primero los efectos viejos (movimientos e items) para que
      // la validación de abajo, hecha con el mismo `tx`, "vea" el mundo sin
      // este consumo — así se detecta si alguna cantidad nueva ya no cabe
      // porque, mientras tanto, otro movimiento usó ese stock.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "CONSUMO_ALMACEN" } });
      await tx.consumoAlmacenItem.deleteMany({ where: { consumoAlmacenId: id } });

      const costosOrigen = await costosParaValidacion(almacenOrigenId, tx);
      const precioPorSku = new Map<string, number>();
      for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
        const costo = costosOrigen.get(skuId);
        const disponible = costo?.cantidad ?? 0;
        if (cantidadSolicitada > disponible) {
          const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
          throw new Error(
            `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`
          );
        }
        if (costo?.precioUnitarioPonderado === null || costo?.precioUnitarioPonderado === undefined) {
          const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
          throw new Error(
            `No hay ingresos ni traslados con costo registrados de ${sku?.codigo ?? skuId} en ${almacen.nombre}, así que no se puede calcular su precio unitario ponderado.`
          );
        }
        precioPorSku.set(skuId, costo.precioUnitarioPonderado);
      }

      await tx.consumoAlmacen.update({
        where: { id },
        data: {
          fecha,
          horaRetiro,
          almacenOrigenId,
          retiradoPor,
          retiradoPorDni,
          firmaArchivo,
          fotoEvidenciaArchivo,
          observaciones: observaciones || null,
        },
      });

      for (const item of items) {
        const precioUnitarioPonderadoValor = precioPorSku.get(item.skuId)!;
        const valorConsumido = item.cantidad * precioUnitarioPonderadoValor;

        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: precioUnitarioPonderadoValor,
            valorConsumido,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenOrigenId,
            tipo: "SALIDA",
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            documentoOrigenTipo: "CONSUMO_ALMACEN",
            documentoOrigenId: id,
            fecha,
            observaciones: observaciones || null,
            creadoPorId: usuario?.id,
          },
        });
      }
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenOrigenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    revalidatePath(`/logistica/almacenes/consumos/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar el consumo." };
  }
}

export async function eliminarConsumoAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const consumo = await prisma.consumoAlmacen.findUnique({ where: { id } });
    if (!consumo) return { error: "El consumo ya no existe." };

    await prisma.$transaction(async (tx) => {
      // Reversar un consumo siempre es seguro: le devuelve stock al
      // almacén, nunca puede dejarlo en negativo.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "CONSUMO_ALMACEN" } });
      await tx.consumoAlmacenItem.deleteMany({ where: { consumoAlmacenId: id } });
      await tx.consumoAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${consumo.almacenOrigenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el consumo." };
  }
}
