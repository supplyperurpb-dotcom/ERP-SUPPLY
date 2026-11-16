"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";

export type ServicioGestionadoActionState = { error?: string } | undefined;

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
