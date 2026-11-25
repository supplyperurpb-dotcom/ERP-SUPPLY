import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export type FiltrosProgramaEntregas = {
  desde?: string;
  hasta?: string;
  /** Busca por código/descripción de producto, proveedor o N.º de OC/OS, todo en un solo campo. */
  busqueda?: string;
};

export type FilaProgramaEntregas = {
  id: string;
  fechaTentativa: Date;
  ordenCompraId: string;
  numeroOC: string;
  proveedorRazonSocial: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  /** cantidad * precioUnitario — nunca se guarda, siempre se calcula (ver OrdenCompraEntrega en prisma/schema.prisma). */
  valor: number;
};

// Una sola consulta que arma el listado del submódulo "Programa de
// Entregas" (tabla, tarjetas de resumen y calendario, todos a partir del
// mismo arreglo ya filtrado — nunca una segunda query, para que nunca se
// desalineen entre sí). Pedido explícito, 2026-11-25: acá solo entran
// entregas de órdenes APROBADAS (aprobadas y liberadas totalmente) — ni
// borrador, ni pendientes, ni rechazadas/anuladas, así que no hace falta
// ningún filtro de estado.
export async function obtenerEntregasProgramadas(filtros: FiltrosProgramaEntregas): Promise<FilaProgramaEntregas[]> {
  const busqueda = filtros.busqueda?.trim();

  const where: Prisma.OrdenCompraEntregaWhereInput = {
    AND: [
      { ordenCompraItem: { ordenCompra: { estado: "APROBADO" } } },
      filtros.desde ? { fechaTentativa: { gte: new Date(filtros.desde) } } : {},
      filtros.hasta ? { fechaTentativa: { lte: new Date(filtros.hasta) } } : {},
      busqueda
        ? {
            ordenCompraItem: {
              OR: [
                { sku: { codigo: { contains: busqueda, mode: "insensitive" } } },
                { sku: { descripcion: { contains: busqueda, mode: "insensitive" } } },
                { ordenCompra: { proveedor: { razonSocial: { contains: busqueda, mode: "insensitive" } } } },
                { ordenCompra: { numero: { contains: busqueda, mode: "insensitive" } } },
              ],
            },
          }
        : {},
    ],
  };

  const entregas = await prisma.ordenCompraEntrega.findMany({
    where,
    include: {
      ordenCompraItem: {
        include: { sku: true, ordenCompra: { include: { proveedor: true } } },
      },
    },
    orderBy: { fechaTentativa: "asc" },
    take: 500,
  });

  return entregas.map((entrega) => {
    const item = entrega.ordenCompraItem;
    const orden = item.ordenCompra;
    const cantidad = Number(entrega.cantidad);
    const precioUnitario = Number(item.precioUnitario);
    return {
      id: entrega.id,
      fechaTentativa: entrega.fechaTentativa,
      ordenCompraId: orden.id,
      numeroOC: orden.numero,
      proveedorRazonSocial: orden.proveedor.razonSocial,
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      unidadMedida: item.sku.unidadMedida,
      cantidad,
      precioUnitario,
      moneda: orden.moneda,
      valor: Math.round(cantidad * precioUnitario * 100) / 100,
    };
  });
}
