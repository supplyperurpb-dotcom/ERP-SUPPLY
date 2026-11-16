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

export type CrearRegistroAvanceState = { error?: string; numero?: number } | undefined;

// Crea una nueva sesión numerada ("OS XXX - Registro de Avance N", pedido
// explícito) — cada clic en "Registrar Avance" llama a esto. numero =
// correlativo siguiente dentro de este ServicioGestionado (empieza en 1).
export async function crearRegistroAvanceAction(servicioGestionadoId: string): Promise<CrearRegistroAvanceState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para registrar un avance." };

    const servicio = await prisma.servicioGestionado.findUnique({ where: { id: servicioGestionadoId } });
    if (!servicio) return { error: "Este servicio ya no existe." };

    const ultimo = await prisma.registroAvance.findFirst({
      where: { servicioGestionadoId },
      orderBy: { numero: "desc" },
    });
    const numero = (ultimo?.numero ?? 0) + 1;

    await prisma.registroAvance.create({ data: { servicioGestionadoId, numero, creadoPorId: usuario.id } });

    revalidatePath(`/logistica/gestion-servicios/${servicio.ordenCompraId}`);
    return { numero };
  } catch (e) {
    console.error("Error inesperado en crearRegistroAvanceAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al crear el registro de avance." };
  }
}

// Añade a seguimiento una o más líneas de la OS DENTRO de un
// RegistroAvance puntual (ver "Añadir Items") — ignora silenciosamente
// las que ya estuvieran añadidas en ESE registro (createMany +
// skipDuplicates); una línea sí puede volver a añadirse en un registro
// posterior distinto, mientras le quede saldo.
export async function agregarItemsServicioGestionadoAction(
  registroAvanceId: string,
  ordenCompraItemIds: string[]
): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para añadir ítems." };
    if (ordenCompraItemIds.length === 0) return { error: "Selecciona al menos un ítem." };

    const registro = await prisma.registroAvance.findUnique({
      where: { id: registroAvanceId },
      include: { servicioGestionado: true },
    });
    if (!registro) return { error: "Este registro de avance ya no existe." };

    const itemsValidos = await prisma.ordenCompraItem.findMany({
      where: { id: { in: ordenCompraItemIds }, ordenCompraId: registro.servicioGestionado.ordenCompraId },
      select: { id: true },
    });
    if (itemsValidos.length === 0) return { error: "Ningún ítem seleccionado pertenece a esta orden." };

    await prisma.itemRegistroAvance.createMany({
      data: itemsValidos.map((item) => ({ registroAvanceId, ordenCompraItemId: item.id })),
      skipDuplicates: true,
    });

    revalidatePath(`/logistica/gestion-servicios/${registro.servicioGestionado.ordenCompraId}/registro/${registro.numero}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en agregarItemsServicioGestionadoAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al añadir los ítems." };
  }
}

// Registra UN avance incremental sobre una línea ya añadida en este
// registro — nunca reemplaza avances anteriores, se suman. El saldo
// considera los avances de TODOS los registros de esa misma línea (un
// OrdenCompraItem puede estar añadido en más de un RegistroAvance a lo
// largo del tiempo), recalculado acá mismo contra la base de datos — no
// se confía en lo que el cliente tenía calculado al enviar el formulario.
export async function registrarAvanceServicioAction(
  itemRegistroAvanceId: string,
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

    const itemGestionado = await prisma.itemRegistroAvance.findUnique({
      where: { id: itemRegistroAvanceId },
      include: { ordenCompraItem: true, registroAvance: { include: { servicioGestionado: true } } },
    });
    if (!itemGestionado) return { error: "Este ítem ya no está en seguimiento." };

    // Todos los ItemRegistroAvance (de cualquier registro) de esta misma
    // línea de la OC, con sus avances — el saldo es global a la línea.
    const otrosRegistrosDeEstaLinea = await prisma.itemRegistroAvance.findMany({
      where: { ordenCompraItemId: itemGestionado.ordenCompraItemId },
      include: { avances: true },
    });

    const cantidadTotal = Number(itemGestionado.ordenCompraItem.cantidad);
    const precioUnitario = Number(itemGestionado.ordenCompraItem.precioUnitario);
    const cantidadAvanzada = otrosRegistrosDeEstaLinea.reduce(
      (acc, igr) => acc + igr.avances.reduce((acc2, a) => acc2 + Number(a.cantidad), 0),
      0
    );
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
        itemRegistroAvanceId,
        tipoRegistro,
        porcentaje: tipoRegistro === "PORCENTUAL" ? valor : null,
        cantidad,
        valorizado,
        creadoPorId: usuario.id,
      },
    });

    const { ordenCompraId } = itemGestionado.registroAvance.servicioGestionado;
    revalidatePath(`/logistica/gestion-servicios/${ordenCompraId}/registro/${itemGestionado.registroAvance.numero}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en registrarAvanceServicioAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al registrar el avance." };
  }
}
