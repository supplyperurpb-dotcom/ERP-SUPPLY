import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// Todas las funciones aceptan opcionalmente un cliente de Prisma distinto
// al singleton (típicamente `tx` dentro de un prisma.$transaction) — se usa
// al editar un ingreso/traslado/consumo: primero se borran sus filas
// viejas y LUEGO se valida/recalcula con estas funciones usando ese mismo
// `tx`, para que "vean" el mundo sin el documento viejo dentro de la misma
// transacción (una lectura con el cliente normal no vería ese borrado
// todavía sin commitear).
type Db = PrismaClient | Prisma.TransactionClient;

export type FilaStockAlmacen = {
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  /** Costo unitario ponderado en DÓLARES (valor neto de inventario / cantidad neta). */
  precioUnitarioPonderado: number | null;
};

type CostoSku = { cantidad: number; precioUnitarioPonderado: number | null };

// Stock + costo unitario ponderado de TODOS los sku de un almacén, en una
// sola pasada (usado tanto para el reporte de stock como para validar y
// costear traslados/consumos, evitando recalcular por cada línea).
//
// Cantidad = INGRESO + TRANSFERENCIA (como destino) - SALIDA - TRANSFERENCIA
// (como origen), leído de MovimientoStock (única fuente de verdad del
// stock).
//
// Valor neto = ingresos + traslados recibidos (con el costo que traían del
// almacén de origen, ver TrasladoAlmacenItem.costoUnitario) - consumos -
// traslados enviados. Dividido entre la cantidad da el costo unitario
// ponderado ACTUAL de lo que queda — no solo un promedio histórico de
// ingresos, porque eso ignoraría el valor que entra o sale por traslados.
async function mapaCostosAlmacen(almacenId: string, db: Db = prisma): Promise<Map<string, CostoSku>> {
  const [entradas, salidas, ingresos, trasladosEntrantes, trasladosSalientes, consumos] = await Promise.all([
    db.movimientoStock.groupBy({
      by: ["skuId"],
      where: { almacenDestinoId: almacenId, tipo: { in: ["INGRESO", "TRANSFERENCIA"] } },
      _sum: { cantidad: true },
    }),
    db.movimientoStock.groupBy({
      by: ["skuId"],
      where: { almacenOrigenId: almacenId, tipo: { in: ["SALIDA", "TRANSFERENCIA"] } },
      _sum: { cantidad: true },
    }),
    db.ingresoAlmacenItem.findMany({
      where: { ingresoAlmacen: { almacenId } },
      select: { skuId: true, subtotalUsd: true, fleteAsignadoUsd: true },
    }),
    db.trasladoAlmacenItem.findMany({
      where: { trasladoAlmacen: { almacenDestinoId: almacenId } },
      select: { skuId: true, valorTotal: true, fleteAsignadoUsd: true },
    }),
    db.trasladoAlmacenItem.findMany({
      where: { trasladoAlmacen: { almacenOrigenId: almacenId } },
      select: { skuId: true, valorTotal: true },
    }),
    db.consumoAlmacenItem.findMany({
      where: { consumoAlmacen: { almacenOrigenId: almacenId } },
      select: { skuId: true, valorConsumido: true },
    }),
  ]);

  const cantidadPorSku = new Map<string, number>();
  for (const fila of entradas) {
    cantidadPorSku.set(fila.skuId, (cantidadPorSku.get(fila.skuId) ?? 0) + Number(fila._sum.cantidad ?? 0));
  }
  for (const fila of salidas) {
    cantidadPorSku.set(fila.skuId, (cantidadPorSku.get(fila.skuId) ?? 0) - Number(fila._sum.cantidad ?? 0));
  }

  const valorPorSku = new Map<string, number>();
  const sumarValor = (skuId: string, valor: number) => valorPorSku.set(skuId, (valorPorSku.get(skuId) ?? 0) + valor);
  // Todo el valor se acumula en DÓLARES (moneda base del costeo): los
  // ingresos pueden registrarse en Soles o Dólares (ver
  // IngresoAlmacen.moneda), así que se usan sus columnas *Usd, ya
  // convertidas, para que un mismo producto no mezcle monedas entre
  // distintos ingresos. El flete se suma al costo del producto: es costo de
  // traerlo hasta este almacén. El flete de un consumo (salida) NO se resta
  // aquí — el consumo ya no registra flete, ver ConsumoAlmacenItem.
  for (const i of ingresos) sumarValor(i.skuId, Number(i.subtotalUsd) + Number(i.fleteAsignadoUsd));
  for (const t of trasladosEntrantes) sumarValor(t.skuId, Number(t.valorTotal) + Number(t.fleteAsignadoUsd));
  for (const t of trasladosSalientes) sumarValor(t.skuId, -Number(t.valorTotal));
  for (const c of consumos) sumarValor(c.skuId, -Number(c.valorConsumido));

  const skuIds = new Set([...cantidadPorSku.keys(), ...valorPorSku.keys()]);
  const mapa = new Map<string, CostoSku>();
  for (const skuId of skuIds) {
    const cantidad = cantidadPorSku.get(skuId) ?? 0;
    const valorNeto = valorPorSku.get(skuId) ?? 0;
    mapa.set(skuId, {
      cantidad,
      precioUnitarioPonderado: cantidad > 0 ? valorNeto / cantidad : null,
    });
  }
  return mapa;
}

export async function calcularStockAlmacen(almacenId: string, db: Db = prisma): Promise<FilaStockAlmacen[]> {
  const costos = await mapaCostosAlmacen(almacenId, db);
  const skuIds = Array.from(costos.keys());
  if (skuIds.length === 0) return [];

  const skus = await db.sku.findMany({
    where: { id: { in: skuIds } },
    select: { id: true, codigo: true, descripcion: true, unidadMedida: true },
  });

  return skus
    .map((sku) => {
      const costo = costos.get(sku.id)!;
      const cantidad = Math.round(costo.cantidad * 1000) / 1000;
      return {
        skuId: sku.id,
        codigo: sku.codigo,
        descripcion: sku.descripcion,
        unidadMedida: sku.unidadMedida,
        cantidad,
        precioUnitarioPonderado:
          costo.precioUnitarioPonderado !== null ? Math.round(costo.precioUnitarioPonderado * 10000) / 10000 : null,
      };
    })
    .filter((fila) => fila.cantidad !== 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// Stock disponible + costo unitario ponderado de un conjunto de sku en un
// almacén, en una sola consulta — usado por traslados y consumos para
// validar cantidades y costear las líneas sin recalcular por cada una.
export async function costosParaValidacion(almacenId: string, db: Db = prisma): Promise<Map<string, CostoSku>> {
  return mapaCostosAlmacen(almacenId, db);
}

// Variantes de una sola línea, para el resto del código que no necesita el
// mapa completo.
export async function stockDisponible(almacenId: string, skuId: string, db: Db = prisma): Promise<number> {
  const mapa = await mapaCostosAlmacen(almacenId, db);
  return mapa.get(skuId)?.cantidad ?? 0;
}

export async function precioUnitarioPonderado(almacenId: string, skuId: string, db: Db = prisma): Promise<number | null> {
  const mapa = await mapaCostosAlmacen(almacenId, db);
  return mapa.get(skuId)?.precioUnitarioPonderado ?? null;
}
