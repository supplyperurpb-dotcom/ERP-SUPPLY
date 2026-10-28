"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero, prorratear } from "@/lib/utils";
import { convertirAUsd, type MonedaCodigo } from "@/lib/constants/moneda";
import { stockDisponible, cantidadPendienteIngresoOC } from "@/lib/stock-almacen";
import { categoriaAlmacenExigidaPorSku, ETIQUETA_CATEGORIA_ALMACEN } from "@/lib/constants/sku";
import { subirArchivo } from "@/lib/storage";
import { ingresoAlmacenSchema, type IngresoAlmacenInput } from "@/lib/validations/almacen";
import type { Prisma } from "@prisma/client";

export type IngresoAlmacenActionState = { error?: string; id?: string; numero?: string } | undefined;

const TIPOS_GUIA_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

// Sube la foto/escaneo/PDF de la guía de remisión antes de registrar el
// ingreso (el formulario primero sube el archivo y recién con la ruta
// devuelta llama a crearIngresoAlmacenAction). Nunca se confía en el
// nombre de archivo del cliente para la ruta final, para evitar
// colisiones o path traversal.
export async function subirGuiaRemisionIngresoAction(formData: FormData): Promise<{ path?: string; error?: string }> {
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
  const ruta = `ingresos-almacen/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  try {
    const path = await subirArchivo(ruta, archivo);
    return { path };
  } catch (e) {
    console.error("Error subiendo guía de remisión:", e);
    return { error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }
}

type Tx = Prisma.TransactionClient;

// Valida el almacén (debe ser general) y la OC (aprobada, de categoría
// Compra) de donde se van a jalar los items, y devuelve lo que se necesita
// para armar el ingreso: moneda/proveedor de la OC y, por cada línea
// enviada, su OrdenCompraItem real (nunca se confía en lo que mande el
// cliente para sku/precio — se vuelve a leer de la OC).
async function validarOrigen(tx: Tx, data: IngresoAlmacenInput, exigirActivo: boolean) {
  const almacen = await tx.almacen.findUnique({ where: { id: data.almacenId } });
  if (!almacen) throw new Error("El almacén seleccionado ya no existe. Actualiza la página e intenta de nuevo.");
  if (exigirActivo && !almacen.activo) {
    throw new Error(`${almacen.nombre} está inactivo. Actívalo antes de registrar ingresos ahí.`);
  }
  if (!almacen.esGeneral) {
    throw new Error("Los ingresos solo se registran en un almacén general; este es un sub-almacén.");
  }

  const orden = await tx.ordenCompra.findUnique({
    where: { id: data.ordenCompraId },
    include: { proveedor: true },
  });
  if (!orden) throw new Error("La orden de compra seleccionada ya no existe. Actualiza la página e intenta de nuevo.");
  if (orden.estado !== "APROBADO" || orden.categoria !== "COMPRA") {
    throw new Error("Solo se puede ingresar desde una orden de compra aprobada.");
  }
  // Una orden Abierta deja de admitir ingresos pasado su plazo de vigencia,
  // aunque siga figurando como APROBADA — no es un estado nuevo, es solo
  // una fecha límite de uso (ver TipoOrdenCompra en el schema).
  if (orden.tipoOrden === "ABIERTA" && orden.vigenteHasta && orden.vigenteHasta < new Date()) {
    throw new Error(
      `${orden.numero} es una orden abierta vencida (vigente hasta ${orden.vigenteHasta.toLocaleDateString("es-PE")}); ya no se pueden registrar ingresos.`
    );
  }

  const itemsOc = await tx.ordenCompraItem.findMany({
    where: { ordenCompraId: orden.id },
    include: { sku: true },
  });
  const itemOcPorId = new Map(itemsOc.map((i) => [i.id, i]));

  for (const item of data.items) {
    const itemOc = itemOcPorId.get(item.ordenCompraItemId);
    if (!itemOc) {
      throw new Error("Uno de los productos no pertenece a la orden de compra seleccionada.");
    }
    if (itemOc.cerrado) {
      throw new Error(`${itemOc.sku.codigo}: esta línea fue cerrada manualmente y ya no admite ingresos.`);
    }
    // Cada código solo puede ingresar al almacén de la categoría que le
    // corresponde según su tipo (Agroquímicos/Fertilizantes/Ósmosis/
    // Suministros) — ver categoriaAlmacenExigidaPorSku.
    const categoriaExigida = categoriaAlmacenExigidaPorSku(itemOc.sku);
    if (categoriaExigida && almacen.categoriaGeneral !== categoriaExigida) {
      throw new Error(
        `${itemOc.sku.codigo} solo se puede ingresar a un almacén de categoría ${ETIQUETA_CATEGORIA_ALMACEN[categoriaExigida]} (${almacen.nombre} no lo es).`
      );
    }
    const pendiente = await cantidadPendienteIngresoOC(item.ordenCompraItemId, tx);
    // Al editar, la línea que se está editando ya "libera" su propia
    // cantidad anterior porque actualizarIngresoAlmacenAction borra los
    // items viejos antes de llamar aquí dentro de la misma transacción.
    if (item.cantidad > pendiente) {
      throw new Error(
        `La cantidad de ${itemOc.sku.codigo} supera lo pendiente de la OC (disponible: ${pendiente}, ingresado ahora: ${item.cantidad}). Actualiza la página e intenta de nuevo.`
      );
    }
    // Lo exige el almacén (Pesticidas/Fertilizantes, para todo lo que
    // ingrese ahí) o el propio SKU (Sku.requiereLote, sin importar el
    // almacén) — ver también el checkbox "Registrar Lote, Fecha de
    // Producción y Fecha de Vencimiento" al crear el SKU.
    if (almacen.categoriaGeneral === "PESTICIDAS" || almacen.categoriaGeneral === "FERTILIZANTES" || itemOc.sku.requiereLote) {
      if (!item.lote?.trim()) {
        throw new Error(`Al código ${itemOc.sku.codigo} no se le ha registrado Lote.`);
      }
      if (!item.fechaProduccion) {
        throw new Error(`Al código ${itemOc.sku.codigo} no se le ha registrado Fecha de Producción.`);
      }
      if (!item.fechaVencimiento) {
        throw new Error(`Al código ${itemOc.sku.codigo} no se le ha registrado Fecha de Vencimiento.`);
      }
    }
  }

  return { almacen, orden, itemOcPorId };
}

export async function crearIngresoAlmacenAction(data: IngresoAlmacenInput): Promise<IngresoAlmacenActionState> {
  const parsed = ingresoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, fechaContabilizacion, almacenId, ordenCompraId, guiaRemision, guiaRemisionArchivo, observaciones, items } =
    parsed.data;

  try {
    const usuario = await getUsuarioActual();

    const nuevoIngreso = await prisma.$transaction(async (tx) => {
      const { orden, itemOcPorId } = await validarOrigen(tx, parsed.data, true);
      const moneda = orden.moneda as MonedaCodigo;

      const precios = items.map((item) => Number(itemOcPorId.get(item.ordenCompraItemId)!.precioUnitario));
      const subtotales = items.map((item, i) => item.cantidad * precios[i]);
      // El flete se eliminó de este flujo (ver ingresoAlmacenSchema): queda
      // siempre en 0, pero las columnas *Asignado siguen existiendo porque
      // las usa el costeo ponderado (mapaCostosAlmacen).
      const fletePorItem = prorratear(0, subtotales);
      const subtotalesUsd = subtotales.map((s) => convertirAUsd(s, moneda));
      const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

      const existentes = await tx.ingresoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((i) => i.numero), "IA-");

      const ingreso = await tx.ingresoAlmacen.create({
        data: {
          numero,
          fecha,
          fechaContabilizacion,
          ocNumero: orden.numero,
          ordenCompraId: orden.id,
          moneda,
          guiaRemision,
          guiaRemisionArchivo,
          remitenteRuc: orden.proveedor.tipoDocumento === "RUC" ? orden.proveedor.numeroDocumento : null,
          remitente: orden.proveedor.razonSocial,
          flete: null,
          proveedorId: orden.proveedorId,
          almacenId,
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemOc = itemOcPorId.get(item.ordenCompraItemId)!;
        const subtotal = subtotales[i];
        const fleteAsignado = fletePorItem[i];
        const subtotalUsd = subtotalesUsd[i];
        const fleteAsignadoUsd = fletePorItemUsd[i];

        await tx.ingresoAlmacenItem.create({
          data: {
            ingresoAlmacenId: ingreso.id,
            ordenCompraItemId: item.ordenCompraItemId,
            skuId: itemOc.skuId,
            cantidad: item.cantidad,
            unidadMedida: itemOc.sku.unidadMedida,
            precioUnitario: precios[i],
            subtotal,
            precioUnitarioUsd: subtotalUsd / item.cantidad,
            subtotalUsd,
            fleteAsignado,
            fleteAsignadoUsd,
            lote: item.lote || null,
            fechaProduccion: item.fechaProduccion ?? null,
            fechaVencimiento: item.fechaVencimiento ?? null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: itemOc.skuId,
            almacenDestinoId: almacenId,
            tipo: "INGRESO",
            cantidad: item.cantidad,
            unidadMedida: itemOc.sku.unidadMedida,
            documentoOrigenTipo: "INGRESO_ALMACEN",
            documentoOrigenId: ingreso.id,
            fecha,
            creadoPorId: usuario?.id,
          },
        });
      }

      return ingreso;
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/ingresos");
    return { id: nuevoIngreso.id, numero: nuevoIngreso.numero };
  } catch (e) {
    console.error("Error inesperado en crearIngresoAlmacenAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el ingreso." };
  }
}

export async function actualizarIngresoAlmacenAction(
  id: string,
  data: IngresoAlmacenInput
): Promise<IngresoAlmacenActionState> {
  const parsed = ingresoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, fechaContabilizacion, almacenId, ordenCompraId, guiaRemision, guiaRemisionArchivo, observaciones, items } =
    parsed.data;

  const existente = await prisma.ingresoAlmacen.findUnique({ where: { id }, include: { items: true } });
  if (!existente) return { error: "El ingreso ya no existe." };

  // Antes de tocar nada: ¿el almacén todavía tiene, de cada producto, al
  // menos lo que este ingreso trajo? Si no, parte de ese stock ya se
  // trasladó o se consumió y no se puede reversar sin dejarlo en negativo.
  for (const item of existente.items) {
    const disponible = await stockDisponible(existente.almacenId, item.skuId);
    if (disponible < Number(item.cantidad)) {
      const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
      return {
        error: `No se puede editar: parte de lo que trajo este ingreso (${sku?.codigo ?? item.skuId}) ya se trasladó o se consumió del almacén.`,
      };
    }
  }

  try {
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      // Se borran las líneas viejas ANTES de validar lo pendiente de la OC,
      // dentro de la misma transacción, para que la cantidad que este mismo
      // ingreso había tomado quede libre otra vez al revalidar.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "INGRESO_ALMACEN" } });
      await tx.ingresoAlmacenItem.deleteMany({ where: { ingresoAlmacenId: id } });

      const { orden, itemOcPorId } = await validarOrigen(tx, parsed.data, false);
      const moneda = orden.moneda as MonedaCodigo;

      const precios = items.map((item) => Number(itemOcPorId.get(item.ordenCompraItemId)!.precioUnitario));
      const subtotales = items.map((item, i) => item.cantidad * precios[i]);
      const fletePorItem = prorratear(0, subtotales);
      const subtotalesUsd = subtotales.map((s) => convertirAUsd(s, moneda));
      const fletePorItemUsd = fletePorItem.map((f) => convertirAUsd(f, moneda));

      await tx.ingresoAlmacen.update({
        where: { id },
        data: {
          fecha,
          fechaContabilizacion,
          ocNumero: orden.numero,
          ordenCompraId: orden.id,
          moneda,
          guiaRemision,
          guiaRemisionArchivo,
          remitenteRuc: orden.proveedor.tipoDocumento === "RUC" ? orden.proveedor.numeroDocumento : null,
          remitente: orden.proveedor.razonSocial,
          flete: null,
          proveedorId: orden.proveedorId,
          almacenId,
          observaciones: observaciones || null,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemOc = itemOcPorId.get(item.ordenCompraItemId)!;
        const subtotal = subtotales[i];
        const fleteAsignado = fletePorItem[i];
        const subtotalUsd = subtotalesUsd[i];
        const fleteAsignadoUsd = fletePorItemUsd[i];

        await tx.ingresoAlmacenItem.create({
          data: {
            ingresoAlmacenId: id,
            ordenCompraItemId: item.ordenCompraItemId,
            skuId: itemOc.skuId,
            cantidad: item.cantidad,
            unidadMedida: itemOc.sku.unidadMedida,
            precioUnitario: precios[i],
            subtotal,
            precioUnitarioUsd: subtotalUsd / item.cantidad,
            subtotalUsd,
            fleteAsignado,
            fleteAsignadoUsd,
            lote: item.lote || null,
            fechaProduccion: item.fechaProduccion ?? null,
            fechaVencimiento: item.fechaVencimiento ?? null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: itemOc.skuId,
            almacenDestinoId: almacenId,
            tipo: "INGRESO",
            cantidad: item.cantidad,
            unidadMedida: itemOc.sku.unidadMedida,
            documentoOrigenTipo: "INGRESO_ALMACEN",
            documentoOrigenId: id,
            fecha,
            creadoPorId: usuario?.id,
          },
        });
      }
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${existente.almacenId}`);
    revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/ingresos");
    revalidatePath(`/logistica/almacenes/ingresos/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarIngresoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar el ingreso." };
  }
}

export async function eliminarIngresoAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const ingreso = await prisma.ingresoAlmacen.findUnique({ where: { id }, include: { items: true } });
    if (!ingreso) return { error: "El ingreso ya no existe." };

    for (const item of ingreso.items) {
      const disponible = await stockDisponible(ingreso.almacenId, item.skuId);
      if (disponible < Number(item.cantidad)) {
        const sku = await prisma.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
        return {
          error: `No se puede eliminar: parte de lo que trajo este ingreso (${sku?.codigo ?? item.skuId}) ya se trasladó o se consumió del almacén.`,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "INGRESO_ALMACEN" } });
      await tx.ingresoAlmacenItem.deleteMany({ where: { ingresoAlmacenId: id } });
      await tx.ingresoAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    revalidatePath(`/logistica/almacenes/${ingreso.almacenId}`);
    revalidatePath("/logistica/almacenes/ingresos");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarIngresoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el ingreso." };
  }
}
