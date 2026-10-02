"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { IGV_TASA, PREFIJO_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { cantidadPendiente, categoriaDeItem, obtenerAprobadoresArea } from "@/lib/compras";
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
          estado: "PENDIENTE",
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

// A diferencia de SolicitudPedido (que tiene un único área y por lo tanto
// un único aprobador configurable), una OC/OS puede jalar líneas de varias
// áreas a la vez, así que su visto bueno lo da un ADMIN.
export async function aprobarOrdenCompraAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario || !usuario.roles.includes("ADMIN")) {
      return { error: "Solo un administrador puede aprobar órdenes." };
    }

    const orden = await prisma.ordenCompra.findUnique({ where: { id } });
    if (!orden) return { error: "La orden ya no existe." };
    if (orden.estado !== "PENDIENTE") {
      return { error: "Solo se pueden aprobar órdenes pendientes." };
    }

    await prisma.ordenCompra.update({
      where: { id },
      data: { estado: "APROBADO", aprobadoPorId: usuario.id, fechaAprobacion: new Date(), comentarioRechazo: null },
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en aprobarOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al aprobar la orden." };
  }
}

export async function rechazarOrdenCompraAction(id: string, comentario?: string): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario || !usuario.roles.includes("ADMIN")) {
      return { error: "Solo un administrador puede rechazar órdenes." };
    }

    const orden = await prisma.ordenCompra.findUnique({ where: { id } });
    if (!orden) return { error: "La orden ya no existe." };
    if (orden.estado !== "PENDIENTE") {
      return { error: "Solo se pueden rechazar órdenes pendientes." };
    }

    await prisma.ordenCompra.update({
      where: { id },
      data: {
        estado: "RECHAZADO",
        aprobadoPorId: usuario.id,
        fechaAprobacion: new Date(),
        comentarioRechazo: comentario || null,
      },
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en rechazarOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al rechazar la orden." };
  }
}

// Anular reemplaza por completo a "eliminar": antes de estar aprobada
// (PENDIENTE/BORRADOR) cualquier usuario con sesión puede anularla y se
// borra directamente; una vez APROBADA, como una OC/OS puede jalar líneas
// de varias áreas a la vez, solo puede anularla un ADMIN o el aprobador
// configurado de alguna de esas áreas — y en ese caso no se borra, queda
// en estado ANULADO (lo que además libera de vuelta a "pendiente" las
// cantidades que había jalado de sus solicitudes de origen).
export async function anularOrdenCompraAction(id: string, comentario?: string): Promise<{ error?: string } | undefined> {
  try {
    const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { items: true } });
    if (!orden) return { error: "La orden ya no existe." };
    if (orden.estado === "RECHAZADO" || orden.estado === "ANULADO") {
      return { error: "Esta orden ya no está activa." };
    }

    if (orden.estado === "APROBADO") {
      const usuario = await getUsuarioActual();
      if (!usuario) return { error: "Debes iniciar sesión para anular una orden." };

      if (!usuario.roles.includes("ADMIN")) {
        const aprobadores = await obtenerAprobadoresArea();
        const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));
        const areasOrden = new Set(orden.items.map((i) => i.centroCosto));
        const esAprobadorDeAlgunArea = [...areasOrden].some((area) => aprobadoresPorArea.get(area) === usuario.id);
        if (!esAprobadorDeAlgunArea) {
          return { error: "Solo el aprobador de alguna de las áreas de esta orden puede anularla." };
        }
      }

      await prisma.ordenCompra.update({
        where: { id },
        data: {
          estado: "ANULADO",
          aprobadoPorId: usuario.id,
          fechaAprobacion: new Date(),
          comentarioRechazo: comentario || null,
        },
      });
    } else {
      const usuario = await getUsuarioActual();
      if (!usuario) return { error: "Debes iniciar sesión para anular una orden." };

      await prisma.$transaction(async (tx) => {
        await tx.ordenCompraItem.deleteMany({ where: { ordenCompraId: id } });
        await tx.ordenCompra.delete({ where: { id } });
      });
    }

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    revalidatePath("/logistica/solicitudes-pedido");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en anularOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al anular la orden." };
  }
}
