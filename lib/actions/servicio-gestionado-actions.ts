"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";

export type ServicioGestionadoActionState = { error?: string } | undefined;
export type TipoRegistroAvanceInput = "PORCENTUAL" | "CANTIDAD";

// Agrega una Orden de Servicio ya APROBADA al módulo de Gestión de
// Servicios — pedido explícito: esto nunca pasa solo, alguien lo elige a
// propósito (ver ordenesServicioDisponiblesParaGestion en lib/compras.ts
// para el criterio de qué órdenes están disponibles para elegir acá).
export async function agregarServicioGestionadoAction(ordenCompraId: string): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para agregar un servicio." };

    const orden = await prisma.ordenCompra.findUnique({
      where: { id: ordenCompraId },
      include: { servicioGestionado: true },
    });
    if (!orden) return { error: "La orden de servicio ya no existe." };
    if (orden.categoria !== "SERVICIO") return { error: "Solo se pueden agregar órdenes de servicio." };
    if (orden.estado !== "APROBADO") return { error: "Solo se pueden agregar órdenes de servicio ya aprobadas." };
    if (orden.servicioGestionado) return { error: "Esta orden de servicio ya fue agregada." };

    await prisma.servicioGestionado.create({
      data: { ordenCompraId, creadoPorId: usuario.id },
    });

    revalidatePath("/logistica/gestion-servicios");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en agregarServicioGestionadoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al agregar el servicio." };
  }
}

// Añade a seguimiento una o más líneas de la OS (ver "Añadir Items" en
// Avance OS) — ignora silenciosamente las que ya estuvieran añadidas
// (createMany + skipDuplicates, por si dos pestañas envían lo mismo).
export async function agregarItemsServicioGestionadoAction(
  servicioGestionadoId: string,
  ordenCompraItemIds: string[]
): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para añadir ítems." };
    if (ordenCompraItemIds.length === 0) return { error: "Selecciona al menos un ítem." };

    const servicio = await prisma.servicioGestionado.findUnique({ where: { id: servicioGestionadoId } });
    if (!servicio) return { error: "Este servicio ya no existe." };

    const itemsValidos = await prisma.ordenCompraItem.findMany({
      where: { id: { in: ordenCompraItemIds }, ordenCompraId: servicio.ordenCompraId },
      select: { id: true },
    });
    if (itemsValidos.length === 0) return { error: "Ningún ítem seleccionado pertenece a esta orden." };

    await prisma.itemServicioGestionado.createMany({
      data: itemsValidos.map((item) => ({ servicioGestionadoId, ordenCompraItemId: item.id })),
      skipDuplicates: true,
    });

    revalidatePath(`/logistica/gestion-servicios/${servicio.ordenCompraId}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en agregarItemsServicioGestionadoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al añadir los ítems." };
  }
}

// Registra UN avance incremental sobre una línea ya añadida (ver Avance
// OS) — nunca reemplaza avances anteriores, se suman (ver saldo en
// page.tsx: cantidad del ítem menos la suma de todos sus avances). El
// saldo se recalcula acá mismo, contra la base de datos, para no confiar
// en lo que el cliente tenía calculado al momento de enviar el formulario.
export async function registrarAvanceServicioAction(
  itemServicioGestionadoId: string,
  tipoRegistro: TipoRegistroAvanceInput,
  valor: number
): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para registrar un avance." };
    if (!Number.isFinite(valor) || valor <= 0) {
      return { error: tipoRegistro === "PORCENTUAL" ? "Ingresa un porcentaje válido." : "Ingresa una cantidad válida." };
    }
    if (tipoRegistro === "PORCENTUAL" && valor > 100) {
      return { error: "El porcentaje no puede superar 100." };
    }

    const itemGestionado = await prisma.itemServicioGestionado.findUnique({
      where: { id: itemServicioGestionadoId },
      include: { ordenCompraItem: true, avances: true },
    });
    if (!itemGestionado) return { error: "Este ítem ya no está en seguimiento." };

    const cantidadTotal = Number(itemGestionado.ordenCompraItem.cantidad);
    const precioUnitario = Number(itemGestionado.ordenCompraItem.precioUnitario);
    const cantidadAvanzada = itemGestionado.avances.reduce((acc, a) => acc + Number(a.cantidad), 0);
    const saldoCantidad = cantidadTotal - cantidadAvanzada;

    const cantidad = tipoRegistro === "PORCENTUAL" ? (cantidadTotal * valor) / 100 : valor;
    if (cantidad > saldoCantidad + 0.001) {
      return {
        error: `Esa cantidad supera el saldo pendiente de la línea (saldo: ${saldoCantidad.toFixed(3)}).`,
      };
    }
    const valorizado = Math.round(cantidad * precioUnitario * 100) / 100;

    await prisma.avanceServicioItem.create({
      data: {
        itemServicioGestionadoId,
        tipoRegistro,
        porcentaje: tipoRegistro === "PORCENTUAL" ? valor : null,
        cantidad,
        valorizado,
        creadoPorId: usuario.id,
      },
    });

    const servicio = await prisma.servicioGestionado.findUnique({ where: { id: itemGestionado.servicioGestionadoId } });
    if (servicio) revalidatePath(`/logistica/gestion-servicios/${servicio.ordenCompraId}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en registrarAvanceServicioAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al registrar el avance." };
  }
}
