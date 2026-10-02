import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type ItemPendiente = {
  id: string; // SolicitudPedidoItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  cantidad: number; // cantidad solicitada originalmente
  cantidadJalada: number;
  cantidadPendiente: number;
  unidadMedida: string;
  centroCosto: string;
  observaciones: string | null;
};

export type SolicitudConPendientes = {
  id: string;
  numero: string;
  area: string;
  fecha: Date;
  fechaNecesidad: Date;
  tipoNecesidad: string;
  solicitanteId: string | null;
  items: ItemPendiente[];
};

// Cantidad "jalada" de un SolicitudPedidoItem = suma de OrdenCompraItem.cantidad
// de todas las OC que lo referencian, EXCLUYENDO las rechazadas/anuladas (esas
// liberan la cantidad de vuelta al pool de pendientes). Pendiente = cantidad
// solicitada - jalada. Solo se listan solicitudes con al menos un item con
// pendiente > 0, y solo esos items (los ya completados no aparecen).
export async function calcularSolicitudesConPendientes(db: Db = prisma): Promise<SolicitudConPendientes[]> {
  const solicitudes = await db.solicitudPedido.findMany({
    where: { estado: { notIn: ["RECHAZADO", "ANULADO"] } },
    include: { items: { include: { sku: true } } },
    orderBy: { fecha: "asc" },
  });

  const itemIds = solicitudes.flatMap((s) => s.items.map((i) => i.id));
  if (itemIds.length === 0) return [];

  const jaladoPorItem = await db.ordenCompraItem.groupBy({
    by: ["solicitudPedidoItemId"],
    where: {
      solicitudPedidoItemId: { in: itemIds },
      ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } },
    },
    _sum: { cantidad: true },
  });
  const jaladoMap = new Map(jaladoPorItem.map((j) => [j.solicitudPedidoItemId as string, Number(j._sum.cantidad ?? 0)]));

  const resultado: SolicitudConPendientes[] = [];
  for (const solicitud of solicitudes) {
    const items: ItemPendiente[] = [];
    for (const item of solicitud.items) {
      const cantidad = Number(item.cantidad);
      const cantidadJalada = jaladoMap.get(item.id) ?? 0;
      const cantidadPendiente = Math.round((cantidad - cantidadJalada) * 1000) / 1000;
      if (cantidadPendiente <= 0) continue;
      items.push({
        id: item.id,
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        cantidad,
        cantidadJalada,
        cantidadPendiente,
        unidadMedida: item.unidadMedida,
        centroCosto: item.centroCosto,
        observaciones: item.observaciones,
      });
    }
    if (items.length === 0) continue;
    resultado.push({
      id: solicitud.id,
      numero: solicitud.numero,
      area: solicitud.area,
      fecha: solicitud.fecha,
      fechaNecesidad: solicitud.fechaNecesidad,
      tipoNecesidad: solicitud.tipoNecesidad,
      solicitanteId: solicitud.solicitanteId,
      items,
    });
  }
  return resultado;
}

// Pendiente de UN item puntual, usado para validar en el momento de guardar
// una OC (dentro de la misma transacción, para evitar condiciones de
// carrera entre dos personas jalando el mismo item a la vez).
export async function cantidadPendiente(solicitudPedidoItemId: string, db: Db = prisma): Promise<number> {
  const item = await db.solicitudPedidoItem.findUnique({ where: { id: solicitudPedidoItemId } });
  if (!item) return 0;
  const jalado = await db.ordenCompraItem.aggregate({
    where: { solicitudPedidoItemId, ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } } },
    _sum: { cantidad: true },
  });
  return Number(item.cantidad) - Number(jalado._sum.cantidad ?? 0);
}
