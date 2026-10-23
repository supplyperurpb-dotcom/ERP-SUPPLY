"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { calcularStockTotal } from "@/lib/stock-almacen";
import { solicitudDespachoSchema, type SolicitudDespachoInput } from "@/lib/validations/solicitud-despacho";

export type SolicitudDespachoActionState = { error?: string; id?: string; numero?: string } | undefined;

// No necesita aprobación: queda lista para atenderse apenas se crea, igual
// que la antigua Solicitud de Traslado. Quien pide no elige almacén (eso lo
// decide Almacén al atenderla con un Consumo normal — ver
// consumo-almacen-actions.ts); el stock disponible que ve el formulario es
// la suma de todos los almacenes (calcularStockTotal), y aquí solo se hace
// un sanity-check contra ese total (no reserva nada).
export async function crearSolicitudDespachoAction(data: SolicitudDespachoInput): Promise<SolicitudDespachoActionState> {
  const parsed = solicitudDespachoSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { fecha, observaciones, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();
    // Igual que en SolicitudPedido: el área solo es editable para Supply
    // Chain y ADMIN; para cualquier otro usuario se fuerza la suya propia
    // aquí, sin confiar en el valor que llegó del cliente.
    const areaPuedeElegir = !usuario?.area || usuario.area === "SUPPLY_CHAIN" || usuario.roles.includes("ADMIN");
    const area = areaPuedeElegir ? parsed.data.area : (usuario!.area as typeof parsed.data.area);

    const cantidadPorSku = new Map<string, number>();
    for (const item of items) {
      cantidadPorSku.set(item.skuId, (cantidadPorSku.get(item.skuId) ?? 0) + item.cantidad);
    }
    const stockTotal = await calcularStockTotal();
    const disponiblePorSku = new Map(stockTotal.map((s) => [s.skuId, s.cantidad]));
    for (const [skuId, cantidadSolicitada] of cantidadPorSku) {
      const disponible = disponiblePorSku.get(skuId) ?? 0;
      if (cantidadSolicitada > disponible) {
        const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { codigo: true } });
        return {
          error: `No hay suficiente stock de ${sku?.codigo ?? skuId} en ningún almacén (disponible: ${disponible}, solicitado: ${cantidadSolicitada}).`,
        };
      }
    }

    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const existentes = await tx.solicitudDespacho.findMany({ select: { numero: true } });
      const numero = siguienteNumero(existentes.map((s) => s.numero), "SD-");

      const solicitud = await tx.solicitudDespacho.create({
        data: {
          numero,
          area,
          fecha,
          observaciones: observaciones || null,
          solicitanteId: usuario?.id,
          creadoPorId: usuario?.id,
        },
      });

      for (const item of items) {
        await tx.solicitudDespachoItem.create({
          data: {
            solicitudDespachoId: solicitud.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            unidadMedida: item.unidadMedida,
            centroCosto: item.centroCosto,
            campo: item.campo || null,
          },
        });
      }

      return solicitud;
    });

    revalidatePath("/logistica/solicitudes-despacho");
    return { id: nuevaSolicitud.id, numero: nuevaSolicitud.numero };
  } catch (e) {
    console.error("Error inesperado en crearSolicitudDespachoAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la solicitud." };
  }
}

// Igual que la antigua Solicitud de Traslado: no hay estado de aprobación
// que proteja el borrado, solo que ningún consumo ya haya atendido alguna
// de sus líneas.
export async function eliminarSolicitudDespachoAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const solicitud = await prisma.solicitudDespacho.findUnique({ where: { id } });
    if (!solicitud) return { error: "La solicitud ya no existe." };

    const itemsAtendidos = await prisma.consumoAlmacenItem.count({
      where: { solicitudDespachoItem: { solicitudDespachoId: id } },
    });
    if (itemsAtendidos > 0) {
      return { error: "No se puede eliminar: ya hay un consumo que atendió productos de esta solicitud." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.solicitudDespachoItem.deleteMany({ where: { solicitudDespachoId: id } });
      await tx.solicitudDespacho.delete({ where: { id } });
    });

    revalidatePath("/logistica/solicitudes-despacho");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarSolicitudDespachoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar la solicitud." };
  }
}
