"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { IGV_TASA, PREFIJO_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { cantidadPendiente, categoriaDeItem } from "@/lib/compras";
import { ordenCompraSchema, type OrdenCompraInput } from "@/lib/validations/compras";

export type OrdenCompraActionState = { error?: string; id?: string } | undefined;

export async function crearOrdenCompraAction(data: OrdenCompraInput): Promise<OrdenCompraActionState> {
  const parsed = ordenCompraSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { proveedorId, fecha, moneda, items } = parsed.data;

  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) {
    return { error: "El proveedor seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  // Si dos líneas repiten el mismo item de solicitud, se valida la suma.
  const cantidadPorItem = new Map<string, number>();
  for (const item of items) {
    cantidadPorItem.set(item.solicitudPedidoItemId, (cantidadPorItem.get(item.solicitudPedidoItemId) ?? 0) + item.cantidad);
  }

  const subtotales = items.map((item) => Math.round(item.cantidad * item.precioUnitario * 100) / 100);
  const subtotal = subtotales.reduce((a, b) => a + b, 0);
  const igv = items.reduce((acc, item, i) => (item.gravado ? acc + subtotales[i] * IGV_TASA : acc), 0);
  const igvRedondeado = Math.round(igv * 100) / 100;
  const montoTotal = Math.round((subtotal + igvRedondeado) * 100) / 100;

  try {
    const usuario = await getUsuarioActual();

    const nuevaOrden = await prisma.$transaction(async (tx) => {
      // Se valida dentro de la transacción (no antes) para que dos personas
      // no puedan jalar al mismo tiempo más de lo pendiente real, y para que
      // no se mezclen items de categoría COMPRA y SERVICIO en una misma OC.
      let categoria: CategoriaCompraCodigo | null = null;
      for (const [solicitudPedidoItemId, cantidadSolicitadaAhora] of cantidadPorItem) {
        const pendiente = await cantidadPendiente(solicitudPedidoItemId, tx);
        const categoriaItem = await categoriaDeItem(solicitudPedidoItemId, tx);
        if (cantidadSolicitadaAhora > pendiente) {
          const itemOriginal = await tx.solicitudPedidoItem.findUnique({
            where: { id: solicitudPedidoItemId },
            include: { sku: true, solicitudPedido: true },
          });
          const etiqueta = itemOriginal
            ? `${itemOriginal.sku.codigo} (solicitud ${itemOriginal.solicitudPedido.numero})`
            : solicitudPedidoItemId;
          throw new Error(
            `La cantidad de ${etiqueta} supera lo pendiente (disponible: ${pendiente}, solicitado ahora: ${cantidadSolicitadaAhora}). Actualiza la página e intenta de nuevo.`
          );
        }
        if (categoria === null) {
          categoria = categoriaItem;
        } else if (categoriaItem !== null && categoriaItem !== categoria) {
          throw new Error(
            "No se puede mezclar ítems de solicitudes de Compra y de Servicio en una misma orden. Crea una orden separada para cada categoría."
          );
        }
      }
      if (categoria === null) {
        throw new Error("No se pudo determinar la categoría (Compra/Servicio) de los ítems seleccionados.");
      }

      const existentes = await tx.ordenCompra.findMany({ where: { categoria }, select: { numero: true } });
      const numero = siguienteNumero(existentes.map((o) => o.numero), PREFIJO_ORDEN[categoria], 9);

      const orden = await tx.ordenCompra.create({
        data: {
          numero,
          categoria,
          proveedorId,
          fecha,
          moneda,
          subtotal,
          igv: igvRedondeado,
          montoTotal,
          creadoPorId: usuario?.id,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await tx.ordenCompraItem.create({
          data: {
            ordenCompraId: orden.id,
            solicitudPedidoItemId: item.solicitudPedidoItemId,
            skuId: item.skuId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: subtotales[i],
            gravado: item.gravado,
            centroCosto: item.centroCosto,
          },
        });
      }

      return orden;
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath("/logistica/solicitudes-pedido");
    return { id: nuevaOrden.id };
  } catch (e) {
    console.error("Error inesperado en crearOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al guardar la orden de compra." };
  }
}

export async function eliminarOrdenCompraAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.ordenCompraItem.deleteMany({ where: { ordenCompraId: id } });
      await tx.ordenCompra.delete({ where: { id } });
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath("/logistica/solicitudes-pedido");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la orden de compra." };
  }
}
