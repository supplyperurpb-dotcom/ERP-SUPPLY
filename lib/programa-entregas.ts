import { prisma } from "@/lib/db/prisma";
import type { EstadoDocumento, EstadoEntregaProgramada, Prisma } from "@prisma/client";

export type FiltrosProgramaEntregas = {
  desde?: string;
  hasta?: string;
  producto?: string;
  proveedor?: string;
  numeroOC?: string;
  estadoOC?: EstadoDocumento;
  estadoEntrega?: EstadoEntregaProgramada;
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
  estadoOC: EstadoDocumento;
  estadoEntrega: EstadoEntregaProgramada;
};

// Una sola consulta que arma el listado del submódulo "Programa de
// Entregas" (tabla, tarjetas de resumen y calendario, todos a partir del
// mismo arreglo ya filtrado — nunca una segunda query, para que nunca se
// desalineen entre sí). Mismo patrón de filtros por URL que
// app/(dashboard)/comex/consulta-rechazos/page.tsx.
export async function obtenerEntregasProgramadas(filtros: FiltrosProgramaEntregas): Promise<FilaProgramaEntregas[]> {
  const where: Prisma.OrdenCompraEntregaWhereInput = {
    AND: [
      filtros.desde ? { fechaTentativa: { gte: new Date(filtros.desde) } } : {},
      filtros.hasta ? { fechaTentativa: { lte: new Date(filtros.hasta) } } : {},
      filtros.estadoEntrega ? { estado: filtros.estadoEntrega } : {},
      filtros.producto
        ? {
            ordenCompraItem: {
              sku: {
                OR: [
                  { codigo: { contains: filtros.producto, mode: "insensitive" } },
                  { descripcion: { contains: filtros.producto, mode: "insensitive" } },
                ],
              },
            },
          }
        : {},
      filtros.proveedor
        ? { ordenCompraItem: { ordenCompra: { proveedor: { razonSocial: { contains: filtros.proveedor, mode: "insensitive" } } } } }
        : {},
      filtros.numeroOC
        ? { ordenCompraItem: { ordenCompra: { numero: { contains: filtros.numeroOC, mode: "insensitive" } } } }
        : {},
      filtros.estadoOC ? { ordenCompraItem: { ordenCompra: { estado: filtros.estadoOC } } } : {},
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
      estadoOC: orden.estado,
      estadoEntrega: entrega.estado,
    };
  });
}
