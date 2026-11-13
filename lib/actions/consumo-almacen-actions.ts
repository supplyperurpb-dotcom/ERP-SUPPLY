"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import {
  costosParaValidacion,
  costosAFecha,
  calcularStockPorLote,
  categoriaEfectivaAlmacen,
  almacenPermitidoParaConsumo,
  calcularStockPorAlmacenParaSku,
  type StockPorAlmacen,
} from "@/lib/stock-almacen";
import { categoriaAlmacenExigidaPorSku, ETIQUETA_CATEGORIA_ALMACEN } from "@/lib/constants/sku";
import { subirArchivo } from "@/lib/storage";
import { consumoAlmacenSchema, type ConsumoAlmacenInput } from "@/lib/validations/almacen";
import type { Almacen, AlmacenCategoriaGeneral, Prisma, PrismaClient } from "@prisma/client";

export type ConsumoAlmacenActionState = { error?: string; id?: string } | undefined;

type Db = PrismaClient | Prisma.TransactionClient;
type Item = ConsumoAlmacenInput["items"][number];

// En un almacén de Agroquímicos y Fertilizantes, cada línea debe indicar de
// qué lote se despacha (igual que el ingreso exige lote al entrar), y esa
// cantidad no puede superar lo que queda de ese lote puntual — no solo el
// total del SKU en el almacén (que ya valida costosParaValidacion aparte).
async function validarLotesSiAplica(almacen: Almacen, items: Item[], db: Db): Promise<{ error?: string }> {
  if (almacen.categoriaGeneral !== "PESTICIDAS" && almacen.categoriaGeneral !== "FERTILIZANTES") return {};

  for (const item of items) {
    if (!item.lote?.trim() || !item.fechaProduccion || !item.fechaVencimiento) {
      const sku = await db.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
      return {
        error: `${sku?.codigo ?? item.skuId}: lote, fecha de producción y fecha de vencimiento son obligatorios en este almacén.`,
      };
    }
  }

  const cantidadPorSkuLote = new Map<string, number>();
  for (const item of items) {
    const clave = `${item.skuId}::${item.lote}`;
    cantidadPorSkuLote.set(clave, (cantidadPorSkuLote.get(clave) ?? 0) + item.cantidad);
  }
  for (const item of items) {
    const clave = `${item.skuId}::${item.lote}`;
    const cantidadSolicitada = cantidadPorSkuLote.get(clave)!;
    const lotes = await calcularStockPorLote(almacen.id, item.skuId, db);
    const disponible = lotes.find((l) => l.lote === item.lote)?.cantidad ?? 0;
    if (cantidadSolicitada > disponible) {
      const sku = await db.sku.findUnique({ where: { id: item.skuId }, select: { codigo: true } });
      return {
        error: `No hay suficiente stock del lote ${item.lote} de ${sku?.codigo ?? item.skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
      };
    }
  }
  return {};
}

// En un almacén de Combustible, cada línea solo puede ser un SKU de
// subfamilia "Combustibles" (diesel/gasohol) — nunca se confía en lo que
// el combobox del cliente ya filtró, se vuelve a verificar acá.
async function validarSubfamiliaCombustibleSiAplica(almacen: Almacen, items: Item[], db: Db): Promise<{ error?: string }> {
  if (almacen.categoriaGeneral !== "COMBUSTIBLE") return {};

  const skuIds = [...new Set(items.map((i) => i.skuId))];
  const skus = await db.sku.findMany({ where: { id: { in: skuIds } }, select: { id: true, codigo: true, subfamilia: true } });
  const noCombustible = skus.find((s) => s.subfamilia !== "Combustibles");
  if (noCombustible) {
    return { error: `${noCombustible.codigo}: en ${almacen.nombre} solo se pueden despachar productos de subfamilia Combustibles.` };
  }
  return {};
}

// Entre los almacenes de categoría Empaques, los consumos solo se pueden
// registrar desde "ALMACÉN PRODUCCIÓN" — ver almacenPermitidoParaConsumo.
function validarAlmacenEmpaquesSiAplica(almacen: Almacen): { error?: string } {
  if (!almacenPermitidoParaConsumo(almacen)) {
    return { error: `Los consumos de materiales de empaque solo se pueden registrar desde Almacén Producción, no desde ${almacen.nombre}.` };
  }
  return {};
}

// Cada código solo puede consumirse desde el almacén de la categoría que le
// corresponde según su tipo (Agroquímicos/Fertilizantes/Ósmosis/
// Suministros) — ver categoriaAlmacenExigidaPorSku.
async function validarCategoriaExclusivaSiAplica(almacen: Almacen, items: Item[], db: Db): Promise<{ error?: string }> {
  const categoriaAlmacen = await categoriaEfectivaAlmacen(almacen, db);
  const skuIds = [...new Set(items.map((i) => i.skuId))];
  const skus = await db.sku.findMany({ where: { id: { in: skuIds } }, select: { codigo: true, descripcion: true, subfamilia: true } });
  for (const sku of skus) {
    const categoriaExigida = categoriaAlmacenExigidaPorSku(sku);
    if (categoriaExigida && categoriaAlmacen !== categoriaExigida) {
      return {
        error: `${sku.codigo} solo se puede consumir desde un almacén de categoría ${ETIQUETA_CATEGORIA_ALMACEN[categoriaExigida]} (${almacen.nombre} no lo es).`,
      };
    }
  }
  return {};
}

// Un almacén de Combustible exige indicar a qué vehículo se le despachó
// (placa, jalada del catálogo Vehiculo) y el horómetro/kilometraje al
// momento del despacho. vehiculoPlaca/horometroKilometraje son del
// documento (una sola firma para todo el retiro, aunque reparta líneas
// entre varios almacenes) — se exigen si CUALQUIERA de los almacenes de
// las líneas es de categoría Combustible.
async function validarVehiculoSiAplica(
  almacenesUsados: Almacen[],
  vehiculoPlaca: string | undefined,
  horometroKilometraje: number | undefined
): Promise<{ error?: string }> {
  if (!almacenesUsados.some((a) => a.categoriaGeneral === "COMBUSTIBLE")) return {};

  if (!vehiculoPlaca?.trim()) {
    return { error: "Selecciona la placa del vehículo que recibe el combustible." };
  }
  if (horometroKilometraje === undefined || horometroKilometraje === null) {
    return { error: "El horómetro/kilometraje del vehículo es obligatorio en este almacén." };
  }

  const vehiculo = await prisma.vehiculo.findUnique({ where: { placa: vehiculoPlaca } });
  if (!vehiculo || !vehiculo.activo) {
    return { error: "Esa placa no está en la lista de vehículos. Agrégala en Listas > Vehículos." };
  }
  return {};
}

const TIPOS_FOTO_PERMITIDOS = ["image/jpeg", "image/png"];

// El combobox del formulario ya solo ofrece retiradores con permiso en el
// almacén elegido, pero nunca se confía en lo que mande el cliente: se
// vuelve a verificar acá que el DNI recibido sea un RetiradorAutorizado
// activo y con TODOS los almacenes usados en su lista de permitidos (si
// las líneas reparten el retiro entre varios almacenes, debe poder retirar
// de cada uno).
async function verificarRetiradorAutorizado(dni: string, almacenIds: string[]): Promise<{ error?: string }> {
  const retirador = await prisma.retiradorAutorizado.findUnique({
    where: { dni },
    include: { almacenesPermitidos: true },
  });
  if (!retirador || !retirador.activo) {
    return { error: "Esa persona no está en la lista de retiradores autorizados." };
  }
  const permitidos = new Set(retirador.almacenesPermitidos.map((p) => p.almacenId));
  if (!almacenIds.every((id) => permitidos.has(id))) {
    return { error: `${retirador.nombres} ${retirador.apellidos} no tiene permiso de retirar de todos los almacenes de esta lista.` };
  }
  return {};
}

type ItemConPrecio = Item & { precioUnitarioPonderado: number; valorConsumido: number };

// Agrupa las líneas por almacén, corre todas las validaciones que antes
// eran "de la cabecera" para cada grupo, y calcula el precio ponderado de
// cada línea — tal como era en `fecha` (el día de la operación), nunca el
// de hoy (ver costosAFecha). La cantidad DISPONIBLE se valida contra el
// stock físico de AHORA (costosParaValidacion), por (almacén, sku): si dos
// líneas del mismo almacén piden el mismo sku, se suman antes de comparar.
async function validarYCostearItems(
  tx: Db,
  items: Item[],
  fecha: Date,
  exigirActivo: boolean
): Promise<{ error?: string; itemsConPrecio?: ItemConPrecio[]; almacenesUsados?: Almacen[] }> {
  const almacenIds = [...new Set(items.map((i) => i.almacenOrigenId))];
  const almacenes = await tx.almacen.findMany({ where: { id: { in: almacenIds } } });
  const almacenPorId = new Map(almacenes.map((a) => [a.id, a]));
  for (const almacenId of almacenIds) {
    if (!almacenPorId.has(almacenId)) {
      return { error: "Uno de los almacenes seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
    }
  }
  const almacenesUsados = almacenIds.map((id) => almacenPorId.get(id)!);

  if (exigirActivo) {
    const inactivo = almacenesUsados.find((a) => !a.activo);
    if (inactivo) return { error: `${inactivo.nombre} está inactivo. Actívalo antes de registrar consumos ahí.` };
  }

  const itemsPorAlmacen = new Map<string, Item[]>();
  for (const item of items) {
    const lista = itemsPorAlmacen.get(item.almacenOrigenId) ?? [];
    lista.push(item);
    itemsPorAlmacen.set(item.almacenOrigenId, lista);
  }

  const precioPorAlmacenSku = new Map<string, number>();
  for (const [almacenId, itemsDelAlmacen] of itemsPorAlmacen) {
    const almacen = almacenPorId.get(almacenId)!;

    const permisoEmpaques = validarAlmacenEmpaquesSiAplica(almacen);
    if (permisoEmpaques.error) return permisoEmpaques;

    const permisoCategoria = await validarCategoriaExclusivaSiAplica(almacen, itemsDelAlmacen, tx);
    if (permisoCategoria.error) return permisoCategoria;

    const permisoLotes = await validarLotesSiAplica(almacen, itemsDelAlmacen, tx);
    if (permisoLotes.error) return permisoLotes;

    const permisoCombustible = await validarSubfamiliaCombustibleSiAplica(almacen, itemsDelAlmacen, tx);
    if (permisoCombustible.error) return permisoCombustible;

    const cantidadPorSku = new Map<string, number>();
    for (const item of itemsDelAlmacen) {
      cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
    }

    // El stock disponible se valida contra el total físico de AHORA, pero
    // el precio con el que se costea el consumo es el ponderado tal como
    // era en `fecha` — no el de hoy.
    const [costosOrigen, costosHistoricos] = await Promise.all([
      costosParaValidacion(almacenId, tx),
      costosAFecha(almacenId, fecha, tx),
    ]);
    for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
      const costo = costosOrigen.get(skuId);
      const disponible = costo?.cantidad ?? 0;
      if (cantidadSolicitada > disponible) {
        const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
        return {
          error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ${almacen.nombre} (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
        };
      }
      const costoHistorico = costosHistoricos.get(skuId);
      if (costoHistorico?.precioUnitarioPonderado === null || costoHistorico?.precioUnitarioPonderado === undefined) {
        const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
        return {
          error: `No hay ingresos ni traslados con costo registrados de ${sku?.codigo ?? skuId} en ${almacen.nombre} hasta la fecha de este consumo, así que no se puede calcular su precio unitario ponderado.`,
        };
      }
      precioPorAlmacenSku.set(`${almacenId}::${skuId}`, costoHistorico.precioUnitarioPonderado);
    }
  }

  const itemsConPrecio: ItemConPrecio[] = items.map((item) => {
    const precioUnitarioPonderado = precioPorAlmacenSku.get(`${item.almacenOrigenId}::${item.skuId}`)!;
    return { ...item, precioUnitarioPonderado, valorConsumido: item.cantidad * precioUnitarioPonderado };
  });

  return { itemsConPrecio, almacenesUsados };
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

// Stock de un SKU desglosado por cada almacén elegible para consumirlo
// (de la categoría que le corresponde, ya filtrados a los permitidos para
// consumo — ver almacenPermitidoParaConsumo) — usado por el paso "reparte
// entre almacenes" de "Ver Productos" al atender una Solicitud de
// Despacho (ver consumo-almacen-form.tsx).
export async function obtenerStockPorAlmacenParaSkuAction(skuId: string): Promise<StockPorAlmacen[]> {
  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) return [];
  const categoria = categoriaAlmacenExigidaPorSku(sku);
  if (!categoria) return [];

  const almacenesActivos = await prisma.almacen.findMany({
    where: { activo: true, categoriaGeneral: categoria as AlmacenCategoriaGeneral },
  });
  const elegibles = almacenesActivos.filter(almacenPermitidoParaConsumo);
  return calcularStockPorAlmacenParaSku(
    skuId,
    elegibles.map((a) => ({ id: a.id, codigo: a.codigo, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))
  );
}

export async function crearConsumoAlmacenAction(data: ConsumoAlmacenInput): Promise<ConsumoAlmacenActionState> {
  const parsed = consumoAlmacenSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    fecha,
    fechaContabilizacion,
    horaRetiro,
    retiradoPor,
    retiradoPorDni,
    vehiculoPlaca,
    horometroKilometraje,
    firmaArchivo,
    fotoEvidenciaArchivo,
    observaciones,
    items,
  } = parsed.data;

  const almacenIds = [...new Set(items.map((i) => i.almacenOrigenId))];
  const permiso = await verificarRetiradorAutorizado(retiradoPorDni, almacenIds);
  if (permiso.error) return permiso;

  try {
    const usuario = await getUsuarioActual();

    const nuevoConsumo = await prisma.$transaction(async (tx) => {
      const resultado = await validarYCostearItems(tx, items, fecha, true);
      if (resultado.error) throw new Error(resultado.error);
      const { itemsConPrecio, almacenesUsados } = resultado;

      const permisoVehiculo = await validarVehiculoSiAplica(almacenesUsados!, vehiculoPlaca, horometroKilometraje);
      if (permisoVehiculo.error) throw new Error(permisoVehiculo.error);

      const existentes = await tx.consumoAlmacen.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((c) => c.numero), "CA-");

      const consumo = await tx.consumoAlmacen.create({
        data: {
          numero,
          fecha,
          fechaContabilizacion,
          horaRetiro,
          retiradoPor,
          retiradoPorDni,
          vehiculoPlaca: vehiculoPlaca || null,
          horometroKilometraje: horometroKilometraje ?? null,
          firmaArchivo,
          fotoEvidenciaArchivo,
          observaciones: observaciones || null,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of itemsConPrecio!) {
        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: consumo.id,
            almacenOrigenId: item.almacenOrigenId,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: item.precioUnitarioPonderado,
            valorConsumido: item.valorConsumido,
            lote: item.lote || null,
            fechaProduccion: item.fechaProduccion ?? null,
            fechaVencimiento: item.fechaVencimiento ?? null,
            solicitudDespachoItemId: item.solicitudDespachoItemId || null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenOrigenId: item.almacenOrigenId,
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
    for (const almacenId of almacenIds) revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    revalidatePath("/logistica/solicitudes-despacho");
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
  const {
    fecha,
    fechaContabilizacion,
    horaRetiro,
    retiradoPor,
    retiradoPorDni,
    vehiculoPlaca,
    horometroKilometraje,
    firmaArchivo,
    fotoEvidenciaArchivo,
    observaciones,
    items,
  } = parsed.data;

  const almacenIds = [...new Set(items.map((i) => i.almacenOrigenId))];
  const permiso = await verificarRetiradorAutorizado(retiradoPorDni, almacenIds);
  if (permiso.error) return permiso;

  try {
    await prisma.$transaction(async (tx) => {
      const existente = await tx.consumoAlmacen.findUnique({ where: { id } });
      if (!existente) throw new Error("El consumo ya no existe. Actualiza la página e intenta de nuevo.");

      // Se borran primero los efectos viejos (movimientos e items) para que
      // la validación de abajo, hecha con el mismo `tx`, "vea" el mundo sin
      // este consumo — así se detecta si alguna cantidad nueva ya no cabe
      // porque, mientras tanto, otro movimiento usó ese stock.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "CONSUMO_ALMACEN" } });
      await tx.consumoAlmacenItem.deleteMany({ where: { consumoAlmacenId: id } });

      const usuario = await getUsuarioActual();

      const resultado = await validarYCostearItems(tx, items, fecha, false);
      if (resultado.error) throw new Error(resultado.error);
      const { itemsConPrecio, almacenesUsados } = resultado;

      const permisoVehiculo = await validarVehiculoSiAplica(almacenesUsados!, vehiculoPlaca, horometroKilometraje);
      if (permisoVehiculo.error) throw new Error(permisoVehiculo.error);

      await tx.consumoAlmacen.update({
        where: { id },
        data: {
          fecha,
          fechaContabilizacion,
          horaRetiro,
          retiradoPor,
          retiradoPorDni,
          vehiculoPlaca: vehiculoPlaca || null,
          horometroKilometraje: horometroKilometraje ?? null,
          firmaArchivo,
          fotoEvidenciaArchivo,
          observaciones: observaciones || null,
        },
      });

      for (const item of itemsConPrecio!) {
        await tx.consumoAlmacenItem.create({
          data: {
            consumoAlmacenId: id,
            almacenOrigenId: item.almacenOrigenId,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            precioUnitarioPonderado: item.precioUnitarioPonderado,
            valorConsumido: item.valorConsumido,
            lote: item.lote || null,
            fechaProduccion: item.fechaProduccion ?? null,
            fechaVencimiento: item.fechaVencimiento ?? null,
            solicitudDespachoItemId: item.solicitudDespachoItemId || null,
          },
        });

        await tx.movimientoStock.create({
          data: {
            skuId: item.skuId,
            almacenOrigenId: item.almacenOrigenId,
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
    for (const almacenId of almacenIds) revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    revalidatePath(`/logistica/almacenes/consumos/${id}`);
    revalidatePath("/logistica/solicitudes-despacho");
    return { id };
  } catch (e) {
    console.error("Error inesperado en actualizarConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al actualizar el consumo." };
  }
}

export async function eliminarConsumoAlmacenAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const consumo = await prisma.consumoAlmacen.findUnique({ where: { id }, include: { items: true } });
    if (!consumo) return { error: "El consumo ya no existe." };
    const almacenIds = [...new Set(consumo.items.map((i) => i.almacenOrigenId))];

    await prisma.$transaction(async (tx) => {
      // Reversar un consumo siempre es seguro: le devuelve stock al
      // almacén, nunca puede dejarlo en negativo.
      await tx.movimientoStock.deleteMany({ where: { documentoOrigenId: id, documentoOrigenTipo: "CONSUMO_ALMACEN" } });
      await tx.consumoAlmacenItem.deleteMany({ where: { consumoAlmacenId: id } });
      await tx.consumoAlmacen.delete({ where: { id } });
    });

    revalidatePath("/logistica/almacenes");
    for (const almacenId of almacenIds) revalidatePath(`/logistica/almacenes/${almacenId}`);
    revalidatePath("/logistica/almacenes/consumos");
    revalidatePath("/logistica/solicitudes-despacho");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarConsumoAlmacenAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el consumo." };
  }
}
