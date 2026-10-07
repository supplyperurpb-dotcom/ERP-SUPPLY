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

// ---------------------------------------------------------------------
// Ingreso a almacén desde Orden de Compra: la cantidad pendiente de
// recibir de un OrdenCompraItem es su cantidad menos la suma de
// IngresoAlmacenItem.cantidad de todos los ingresos que ya se hicieron
// contra él (no hay ingresos "rechazados/anulados" — se valida dentro de
// la transacción al crear, igual que cantidadPendiente en lib/compras.ts).
export async function cantidadPendienteIngresoOC(ordenCompraItemId: string, db: Db = prisma): Promise<number> {
  const item = await db.ordenCompraItem.findUnique({ where: { id: ordenCompraItemId } });
  if (!item) return 0;
  const recibido = await db.ingresoAlmacenItem.aggregate({
    where: { ordenCompraItemId },
    _sum: { cantidad: true },
  });
  return Number(item.cantidad) - Number(recibido._sum.cantidad ?? 0);
}

export type ItemOcPendienteIngreso = {
  id: string; // OrdenCompraItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  precioUnitario: number;
  cantidadOc: number;
  cantidadPendiente: number;
};

export type OrdenCompraConPendientesIngreso = {
  id: string;
  numero: string;
  moneda: string;
  proveedorId: string;
  proveedorRazonSocial: string;
  proveedorRuc: string;
  items: ItemOcPendienteIngreso[];
};

// Todas las OC APROBADAS (categoría Compra) con al menos un ítem con
// cantidad pendiente de recibir, para el buscador de "Nuevo ingreso". Un
// ítem que ya se recibió por completo (en uno o varios ingresos) deja de
// aparecer.
export async function calcularOcPendientesIngreso(db: Db = prisma): Promise<OrdenCompraConPendientesIngreso[]> {
  const ordenes = await db.ordenCompra.findMany({
    where: { estado: "APROBADO", categoria: "COMPRA" },
    include: { proveedor: true, items: { include: { sku: true } } },
    orderBy: { fecha: "asc" },
  });

  const itemIds = ordenes.flatMap((o) => o.items.map((i) => i.id));
  if (itemIds.length === 0) return [];

  const recibidoPorItem = await db.ingresoAlmacenItem.groupBy({
    by: ["ordenCompraItemId"],
    where: { ordenCompraItemId: { in: itemIds } },
    _sum: { cantidad: true },
  });
  const recibidoMap = new Map(recibidoPorItem.map((r) => [r.ordenCompraItemId as string, Number(r._sum.cantidad ?? 0)]));

  const resultado: OrdenCompraConPendientesIngreso[] = [];
  for (const orden of ordenes) {
    const items: ItemOcPendienteIngreso[] = [];
    for (const item of orden.items) {
      const cantidadOc = Number(item.cantidad);
      const recibido = recibidoMap.get(item.id) ?? 0;
      const cantidadPendiente = Math.round((cantidadOc - recibido) * 1000) / 1000;
      if (cantidadPendiente <= 0) continue;
      items.push({
        id: item.id,
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        unidadMedida: item.sku.unidadMedida,
        precioUnitario: Number(item.precioUnitario),
        cantidadOc,
        cantidadPendiente,
      });
    }
    if (items.length === 0) continue;
    resultado.push({
      id: orden.id,
      numero: orden.numero,
      moneda: orden.moneda,
      proveedorId: orden.proveedorId,
      proveedorRazonSocial: orden.proveedor.razonSocial,
      proveedorRuc: orden.proveedor.tipoDocumento === "RUC" ? orden.proveedor.numeroDocumento : "",
      items,
    });
  }
  return resultado;
}

// ---------------------------------------------------------------------
// Traslado desde Solicitud de Traslado: la cantidad pendiente de ejecutar
// de un SolicitudTrasladoItem es su cantidad menos la suma de
// TrasladoAlmacenItem.cantidad de todos los traslados que ya se hicieron
// contra él. A diferencia de cantidadPendiente en lib/compras.ts, no hay
// estado de aprobación que verificar: una Solicitud de Traslado es
// utilizable apenas se crea.
export async function cantidadPendienteTrasladoItem(solicitudTrasladoItemId: string, db: Db = prisma): Promise<number> {
  const item = await db.solicitudTrasladoItem.findUnique({ where: { id: solicitudTrasladoItemId } });
  if (!item) return 0;
  const movido = await db.trasladoAlmacenItem.aggregate({
    where: { solicitudTrasladoItemId },
    _sum: { cantidad: true },
  });
  return Number(item.cantidad) - Number(movido._sum.cantidad ?? 0);
}

export type ItemSolicitudTrasladoPendiente = {
  id: string; // SolicitudTrasladoItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  cantidadPendiente: number;
};

export type SolicitudTrasladoConPendientes = {
  id: string;
  numero: string;
  fecha: Date;
  almacenOrigenId: string;
  almacenOrigenNombre: string;
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  items: ItemSolicitudTrasladoPendiente[];
};

// Todas las Solicitudes de Traslado con al menos un ítem pendiente de
// ejecutar, para el buscador de "Nuevo Movimiento > Traslados". Una
// solicitud que ya se ejecutó por completo (en uno o varios traslados) deja
// de aparecer.
export async function calcularSolicitudesTrasladoPendientes(db: Db = prisma): Promise<SolicitudTrasladoConPendientes[]> {
  const solicitudes = await db.solicitudTraslado.findMany({
    include: { almacenOrigen: true, almacenDestino: true, items: { include: { sku: true } } },
    orderBy: { fecha: "asc" },
  });

  const itemIds = solicitudes.flatMap((s) => s.items.map((i) => i.id));
  if (itemIds.length === 0) return [];

  const movidoPorItem = await db.trasladoAlmacenItem.groupBy({
    by: ["solicitudTrasladoItemId"],
    where: { solicitudTrasladoItemId: { in: itemIds } },
    _sum: { cantidad: true },
  });
  const movidoMap = new Map(movidoPorItem.map((m) => [m.solicitudTrasladoItemId as string, Number(m._sum.cantidad ?? 0)]));

  const resultado: SolicitudTrasladoConPendientes[] = [];
  for (const solicitud of solicitudes) {
    const items: ItemSolicitudTrasladoPendiente[] = [];
    for (const item of solicitud.items) {
      const cantidadSolicitada = Number(item.cantidad);
      const movido = movidoMap.get(item.id) ?? 0;
      const cantidadPendiente = Math.round((cantidadSolicitada - movido) * 1000) / 1000;
      if (cantidadPendiente <= 0) continue;
      items.push({
        id: item.id,
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        unidadMedida: item.unidadMedida,
        cantidadSolicitada,
        cantidadPendiente,
      });
    }
    if (items.length === 0) continue;
    resultado.push({
      id: solicitud.id,
      numero: solicitud.numero,
      fecha: solicitud.fecha,
      almacenOrigenId: solicitud.almacenOrigenId,
      almacenOrigenNombre: solicitud.almacenOrigen.nombre,
      almacenDestinoId: solicitud.almacenDestinoId,
      almacenDestinoNombre: solicitud.almacenDestino.nombre,
      items,
    });
  }
  return resultado;
}

// ---------------------------------------------------------------------
// Stock por lote (solo tiene sentido donde el ingreso ya exige lote, ver
// almacén.categoriaGeneral === "AGROQUIMICOS_FERTILIZANTES"): cuánto queda
// de cada lote, sumando lo que entró por ingreso o traslado (recibido) y
// restando lo que ya se consumió o se trasladó (enviado) de ESE mismo
// lote. Un sub-almacén (que nunca recibe ingreso directo) solo tiene stock
// por lote si llegó por traslado — ver crearTrasladoDesdeSolicitudAction,
// que exige lote cuando el origen es de esa categoría y lo hace viajar
// hasta el ítem de traslado, igual que el costo unitario.
export type LoteStock = {
  lote: string;
  fechaProduccion: Date | null;
  fechaVencimiento: Date | null;
  cantidad: number;
  unidadMedida: string;
};

export async function calcularStockPorLote(almacenId: string, skuId: string, db: Db = prisma): Promise<LoteStock[]> {
  const [ingresos, consumos, trasladosEntrantes, trasladosSalientes] = await Promise.all([
    db.ingresoAlmacenItem.findMany({
      where: { skuId, lote: { not: null }, ingresoAlmacen: { almacenId } },
      select: { lote: true, fechaProduccion: true, fechaVencimiento: true, cantidad: true, unidadMedida: true },
    }),
    db.consumoAlmacenItem.findMany({
      where: { skuId, lote: { not: null }, consumoAlmacen: { almacenOrigenId: almacenId } },
      select: { lote: true, cantidad: true },
    }),
    db.trasladoAlmacenItem.findMany({
      where: { skuId, lote: { not: null }, trasladoAlmacen: { almacenDestinoId: almacenId } },
      select: { lote: true, fechaProduccion: true, fechaVencimiento: true, cantidad: true, unidadMedida: true },
    }),
    db.trasladoAlmacenItem.findMany({
      where: { skuId, lote: { not: null }, trasladoAlmacen: { almacenOrigenId: almacenId } },
      select: { lote: true, cantidad: true },
    }),
  ]);

  const porLote = new Map<string, LoteStock>();
  function sumar(lote: string, cantidad: number, fechaProduccion: Date | null, fechaVencimiento: Date | null, unidadMedida: string) {
    const existente = porLote.get(lote);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      porLote.set(lote, { lote, fechaProduccion, fechaVencimiento, cantidad, unidadMedida });
    }
  }

  for (const ing of ingresos) {
    sumar(ing.lote!, Number(ing.cantidad), ing.fechaProduccion, ing.fechaVencimiento, ing.unidadMedida);
  }
  for (const t of trasladosEntrantes) {
    sumar(t.lote!, Number(t.cantidad), t.fechaProduccion, t.fechaVencimiento, t.unidadMedida);
  }
  for (const c of consumos) {
    const existente = porLote.get(c.lote!);
    if (existente) existente.cantidad -= Number(c.cantidad);
  }
  for (const t of trasladosSalientes) {
    const existente = porLote.get(t.lote!);
    if (existente) existente.cantidad -= Number(t.cantidad);
  }

  return [...porLote.values()]
    .map((l) => ({ ...l, cantidad: Math.round(l.cantidad * 1000) / 1000 }))
    .filter((l) => l.cantidad > 0)
    .sort((a, b) => a.lote.localeCompare(b.lote));
}
