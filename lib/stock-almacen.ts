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

// Stock sumado de TODOS los almacenes activos, por SKU — para la Solicitud
// de Despacho, donde quien pide no elige almacén (eso lo decide Almacén al
// atenderla): solo necesita ver si el producto tiene stock en algún lado.
export async function calcularStockTotal(db: Db = prisma): Promise<FilaStockAlmacen[]> {
  const almacenes = await db.almacen.findMany({ where: { activo: true }, select: { id: true } });
  const listas = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id, db)));

  const porSku = new Map<string, FilaStockAlmacen>();
  for (const lista of listas) {
    for (const fila of lista) {
      const existente = porSku.get(fila.skuId);
      if (existente) {
        existente.cantidad = Math.round((existente.cantidad + fila.cantidad) * 1000) / 1000;
      } else {
        porSku.set(fila.skuId, { ...fila });
      }
    }
  }

  return [...porSku.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
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
  // Una línea cerrada a mano (ver cerrarPosicionOrdenCompraItemAction) nunca
  // queda pendiente, sin importar cuánto le falte por recibir.
  if (!item || item.cerrado) return 0;
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
      if (item.cerrado) continue;
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
// Stock por lote (solo tiene sentido donde el ingreso ya exige lote, ver
// almacén.categoriaGeneral === "AGROQUIMICOS_FERTILIZANTES"): cuánto queda
// de cada lote, sumando lo que entró por ingreso o traslado (recibido) y
// restando lo que ya se consumió o se trasladó (enviado) de ESE mismo
// lote. Un sub-almacén (que nunca recibe ingreso directo) solo tiene stock
// por lote si llegó por traslado — ver crearTrasladoAlmacenAction, que
// exige lote cuando el origen es de esa categoría y lo hace viajar hasta
// el ítem de traslado, igual que el costo unitario.
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

// ---------------------------------------------------------------------
// Consumo desde Solicitud de Despacho: la cantidad pendiente de atender de
// un SolicitudDespachoItem es su cantidad menos la suma de
// ConsumoAlmacenItem.cantidad de todos los consumos que ya la referenciaron
// (ver solicitudDespachoItemId en ConsumoAlmacenItem). Igual que la
// Solicitud de Traslado, no hay estado de aprobación: una Solicitud de
// Despacho es atendible apenas se crea.
// ---------------------------------------------------------------------
export async function cantidadPendienteDespachoItem(solicitudDespachoItemId: string, db: Db = prisma): Promise<number> {
  const item = await db.solicitudDespachoItem.findUnique({ where: { id: solicitudDespachoItemId } });
  if (!item) return 0;
  const atendido = await db.consumoAlmacenItem.aggregate({
    where: { solicitudDespachoItemId },
    _sum: { cantidad: true },
  });
  return Number(item.cantidad) - Number(atendido._sum.cantidad ?? 0);
}

export type ItemSolicitudDespachoPendiente = {
  id: string; // SolicitudDespachoItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  centroCosto: string;
  campo: string | null;
  cantidadSolicitada: number;
  cantidadPendiente: number;
};

export type SolicitudDespachoConPendientes = {
  id: string;
  numero: string;
  fecha: Date;
  area: string;
  items: ItemSolicitudDespachoPendiente[];
};

// Todas las Solicitudes de Despacho con al menos un ítem pendiente de
// atender, para el buscador de "Nuevo Consumo". Una solicitud ya atendida
// por completo (en uno o varios consumos) deja de aparecer. El almacén de
// atención NO viene de la solicitud (el solicitante no elige almacén):
// lo decide quien la atiende, al registrar el Consumo.
export async function calcularSolicitudesDespachoPendientes(db: Db = prisma): Promise<SolicitudDespachoConPendientes[]> {
  const solicitudes = await db.solicitudDespacho.findMany({
    include: { items: { include: { sku: true } } },
    orderBy: { fecha: "asc" },
  });

  const itemIds = solicitudes.flatMap((s) => s.items.map((i) => i.id));
  if (itemIds.length === 0) return [];

  const atendidoPorItem = await db.consumoAlmacenItem.groupBy({
    by: ["solicitudDespachoItemId"],
    where: { solicitudDespachoItemId: { in: itemIds } },
    _sum: { cantidad: true },
  });
  const atendidoMap = new Map(atendidoPorItem.map((a) => [a.solicitudDespachoItemId as string, Number(a._sum.cantidad ?? 0)]));

  const resultado: SolicitudDespachoConPendientes[] = [];
  for (const solicitud of solicitudes) {
    const items: ItemSolicitudDespachoPendiente[] = [];
    for (const item of solicitud.items) {
      const cantidadSolicitada = Number(item.cantidad);
      const atendido = atendidoMap.get(item.id) ?? 0;
      const cantidadPendiente = Math.round((cantidadSolicitada - atendido) * 1000) / 1000;
      if (cantidadPendiente <= 0) continue;
      items.push({
        id: item.id,
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        unidadMedida: item.unidadMedida,
        centroCosto: item.centroCosto,
        campo: item.campo,
        cantidadSolicitada,
        cantidadPendiente,
      });
    }
    if (items.length === 0) continue;
    resultado.push({
      id: solicitud.id,
      numero: solicitud.numero,
      fecha: solicitud.fecha,
      area: solicitud.area,
      items,
    });
  }
  return resultado;
}

// Disponible EFECTIVO para pedir en una Solicitud de Despacho NUEVA: el
// stock físico (calcularStockTotal) menos lo que ya está pendiente de
// atender en OTRAS solicitudes todavía abiertas. Nada se descuenta del
// stock real hasta que de verdad se atiende con un Consumo — esto solo
// evita que dos solicitudes distintas puedan pedir, cada una por su
// cuenta, más de lo que en realidad hay.
export async function calcularStockDisponibleDespacho(db: Db = prisma): Promise<FilaStockAlmacen[]> {
  const [stockTotal, pendientes] = await Promise.all([calcularStockTotal(db), calcularSolicitudesDespachoPendientes(db)]);

  const pendientePorSku = new Map<string, number>();
  for (const solicitud of pendientes) {
    for (const item of solicitud.items) {
      pendientePorSku.set(item.skuId, (pendientePorSku.get(item.skuId) ?? 0) + item.cantidadPendiente);
    }
  }

  return stockTotal
    .map((fila) => ({
      ...fila,
      cantidad: Math.round((fila.cantidad - (pendientePorSku.get(fila.skuId) ?? 0)) * 1000) / 1000,
    }))
    .filter((fila) => fila.cantidad > 0);
}
