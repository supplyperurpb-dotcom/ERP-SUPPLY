"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { IGV_TASA, PREFIJO_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import {
  cantidadPendiente,
  categoriaDeItem,
  montoEnUsd,
  obtenerAprobadoresEspeciales,
  rolesFirmaRequeridos,
} from "@/lib/compras";
import {
  ordenCompraSchema,
  editarOrdenCompraSchema,
  type OrdenCompraInput,
  type EditarOrdenCompraInput,
} from "@/lib/validations/compras";

export type OrdenCompraActionState = { error?: string; id?: string } | undefined;

export async function crearOrdenCompraAction(data: OrdenCompraInput): Promise<OrdenCompraActionState> {
  const parsed = ordenCompraSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { proveedorId, fecha, fechaEntrega, condicionPago, lugarEntrega, observaciones, moneda, items } = parsed.data;

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
          // Nace en BORRADOR (editable, nadie la firmó aún) — pasa a
          // PENDIENTE recién con la primera firma (ver firmarOrdenCompraAction).
          estado: "BORRADOR",
          fecha,
          fechaEntrega: fechaEntrega || null,
          condicionPago: condicionPago || null,
          lugarEntrega: lugarEntrega || null,
          observaciones: observaciones || null,
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
            descripcion: item.descripcion || null,
          },
        });
      }

      // Según el monto (en USD equivalente) y si hay algún ítem de RRHH, se
      // crea una firma PENDIENTE por cada rol que debe aprobar antes de que
      // la orden quede del todo APROBADA (ver rolesFirmaRequeridos).
      const centroCostos = [...new Set(items.map((i) => i.centroCosto))];
      const roles = rolesFirmaRequeridos(montoEnUsd(montoTotal, moneda), centroCostos);
      for (const rol of roles) {
        await tx.ordenCompraFirma.create({ data: { ordenCompraId: orden.id, rol } });
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

// Reemplaza al antiguo aprobar/rechazar de un solo clic por ADMIN: cada OC/OS
// tiene una o más firmas requeridas (ver rolesFirmaRequeridos, calculadas al
// crearla) y cada una la resuelve el titular de ese rol especial (o un ADMIN,
// como respaldo). La orden entera queda APROBADA recién cuando todas sus
// firmas están en APROBADO; si cualquiera se RECHAZA, la orden completa pasa
// a RECHAZADO de inmediato.
export async function firmarOrdenCompraAction(
  id: string,
  decision: "APROBADO" | "RECHAZADO",
  comentario?: string
): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para firmar una orden." };

    const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { firmas: true } });
    if (!orden) return { error: "La orden ya no existe." };
    // BORRADOR (recién creada o recién desaprobada del todo) también se
    // puede firmar — la primera firma ya la saca de BORRADOR (ver abajo).
    if (orden.estado !== "BORRADOR" && orden.estado !== "PENDIENTE") {
      return { error: "Solo se pueden firmar órdenes en borrador o pendientes." };
    }

    const firmasPendientes = orden.firmas.filter((f) => f.estado === "PENDIENTE");
    if (firmasPendientes.length === 0) {
      return { error: "Esta orden no tiene firmas pendientes." };
    }

    const aprobadoresEspeciales = await obtenerAprobadoresEspeciales();
    const aprobadorPorRol = new Map(aprobadoresEspeciales.map((a) => [a.rol, a.usuarioId]));
    const firmaDelUsuario = firmasPendientes.find((f) => aprobadorPorRol.get(f.rol) === usuario.id);
    const firmaAUsar = firmaDelUsuario ?? (usuario.roles.includes("ADMIN") ? firmasPendientes[0] : undefined);

    if (!firmaAUsar) {
      return { error: "No tienes un rol de aprobación pendiente en esta orden." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.ordenCompraFirma.update({
        where: { id: firmaAUsar.id },
        data: { estado: decision, usuarioId: usuario.id, fecha: new Date(), comentario: comentario || null },
      });

      if (decision === "RECHAZADO") {
        await tx.ordenCompra.update({
          where: { id },
          data: {
            estado: "RECHAZADO",
            aprobadoPorId: usuario.id,
            fechaAprobacion: new Date(),
            comentarioRechazo: comentario || null,
          },
        });
        return;
      }

      const todasLasFirmas = await tx.ordenCompraFirma.findMany({ where: { ordenCompraId: id } });
      const todasAprobadas = todasLasFirmas.every((f) => (f.id === firmaAUsar.id ? true : f.estado === "APROBADO"));
      if (todasAprobadas) {
        await tx.ordenCompra.update({
          where: { id },
          data: { estado: "APROBADO", aprobadoPorId: usuario.id, fechaAprobacion: new Date(), comentarioRechazo: null },
        });
      } else if (orden.estado === "BORRADOR") {
        // La primera firma (de varias requeridas) saca a la orden del
        // estado editable, aunque todavía falten otras por firmar.
        await tx.ordenCompra.update({ where: { id }, data: { estado: "PENDIENTE" } });
      }
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en firmarOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al firmar la orden." };
  }
}

// Deshace UNA firma ya aprobada (solo quien firmó, o un ADMIN) — pedido
// explícito: "desliberación" firma por firma, no un botón que tumbe todas
// de una. Mientras quede al menos otra firma en APROBADO, la orden vuelve
// a PENDIENTE (sigue el proceso normal de firmas); recién cuando la
// última también se deshace, la orden regresa a BORRADOR y se puede
// editar de nuevo (ver editarOrdenCompraAction).
export async function anularFirmaOrdenCompraAction(
  id: string,
  firmaId: string,
  comentario?: string
): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para anular una firma." };

    const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { firmas: true } });
    if (!orden) return { error: "La orden ya no existe." };
    if (orden.estado === "RECHAZADO" || orden.estado === "ANULADO") {
      return { error: "Esta orden ya no está activa." };
    }

    const firma = orden.firmas.find((f) => f.id === firmaId);
    if (!firma) return { error: "Esa firma ya no existe." };
    if (firma.estado !== "APROBADO") return { error: "Esta firma no está aprobada." };

    const esAdmin = usuario.roles.includes("ADMIN");
    if (firma.usuarioId !== usuario.id && !esAdmin) {
      return { error: "Solo quien firmó puede anular su propia aprobación." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.ordenCompraFirma.update({
        where: { id: firmaId },
        data: { estado: "PENDIENTE", usuarioId: null, fecha: null, comentario: comentario || null },
      });

      const todasLasFirmas = await tx.ordenCompraFirma.findMany({ where: { ordenCompraId: id } });
      const quedaAlgunaAprobada = todasLasFirmas.some((f) => (f.id === firmaId ? false : f.estado === "APROBADO"));

      await tx.ordenCompra.update({
        where: { id },
        data: {
          estado: quedaAlgunaAprobada ? "PENDIENTE" : "BORRADOR",
          aprobadoPorId: null,
          fechaAprobacion: null,
          comentarioRechazo: null,
        },
      });
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en anularFirmaOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al anular la firma." };
  }
}

// Puede editar: quien la creó, o Supply Chain/ADMIN (mismo criterio que
// al crear, porque gestionan órdenes de cualquier área). Solo en BORRADOR
// -- ver anularFirmaOrdenCompraAction para cómo se vuelve a ese estado
// una vez que ya se firmó.
function puedeEditarOrden(usuario: { id: string; area: string | null; roles: string[] }, orden: { creadoPorId: string | null }) {
  return usuario.roles.includes("ADMIN") || usuario.area === "SUPPLY_CHAIN" || orden.creadoPorId === usuario.id;
}

// Edita los datos generales y las líneas YA EXISTENTES de una orden en
// BORRADOR (no se agregan ni quitan líneas acá — para eso se anula y se
// genera una nueva desde la Solped). Como en BORRADOR todas las firmas
// están en blanco (ver arriba), se recalculan desde cero por si el monto
// editado cambia de tramo de aprobación (ver rolesFirmaRequeridos).
export async function editarOrdenCompraAction(id: string, data: EditarOrdenCompraInput): Promise<OrdenCompraActionState> {
  const parsed = editarOrdenCompraSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { proveedorId, fecha, fechaEntrega, condicionPago, lugarEntrega, observaciones, moneda, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para editar una orden." };

    const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { items: true } });
    if (!orden) return { error: "La orden ya no existe." };
    if (!puedeEditarOrden(usuario, orden)) {
      return { error: "No tienes permiso para editar esta orden." };
    }
    if (orden.estado !== "BORRADOR") {
      return { error: "Solo se puede editar una orden en estado Borrador." };
    }

    const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
    if (!proveedor) {
      return { error: "El proveedor seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
    }

    const idsExistentes = new Set(orden.items.map((i) => i.id));
    const idsEnviados = new Set(items.map((i) => i.id));
    if (idsEnviados.size !== idsExistentes.size || [...idsEnviados].some((itemId) => !idsExistentes.has(itemId))) {
      return { error: "Los ítems de la orden cambiaron desde que abriste esta página. Actualízala e intenta de nuevo." };
    }

    const subtotales = items.map((item) => Math.round(item.cantidad * item.precioUnitario * 100) / 100);
    const subtotal = subtotales.reduce((a, b) => a + b, 0);
    const igv = items.reduce((acc, item, i) => (item.gravado ? acc + subtotales[i] * IGV_TASA : acc), 0);
    const igvRedondeado = Math.round(igv * 100) / 100;
    const montoTotal = Math.round((subtotal + igvRedondeado) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.ordenCompra.update({
        where: { id },
        data: {
          proveedorId,
          fecha,
          fechaEntrega: fechaEntrega || null,
          condicionPago: condicionPago || null,
          lugarEntrega: lugarEntrega || null,
          observaciones: observaciones || null,
          moneda,
          subtotal,
          igv: igvRedondeado,
          montoTotal,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await tx.ordenCompraItem.update({
          where: { id: item.id },
          data: {
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: subtotales[i],
            gravado: item.gravado,
            descripcion: item.descripcion || null,
          },
        });
      }

      await tx.ordenCompraFirma.deleteMany({ where: { ordenCompraId: id } });
      const centroCostos = [...new Set(orden.items.map((i) => i.centroCosto))];
      const roles = rolesFirmaRequeridos(montoEnUsd(montoTotal, moneda), centroCostos);
      for (const rol of roles) {
        await tx.ordenCompraFirma.create({ data: { ordenCompraId: id, rol } });
      }
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    return { id };
  } catch (e) {
    console.error("Error inesperado en editarOrdenCompraAction:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar la orden." };
  }
}

// Anular es exclusivo de quien tenga el rol ANULADOR, sin importar el
// estado de la orden (ni ADMIN, ni APROBADOR_GENERAL, ni el aprobador de
// área lo habilitan por sí solos). Nunca se borra el registro: en
// cualquier estado (BORRADOR/PENDIENTE/APROBADO) solo se bloquea, pasando
// a ANULADO — lo que además libera de vuelta a "pendiente" las cantidades
// que había jalado de sus solicitudes de origen, y la saca de la lista de
// OC disponibles para ingresar a almacén (solo se jalan OC APROBADO).
export async function anularOrdenCompraAction(id: string, comentario?: string): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para anular una orden." };
    if (!usuario.roles.includes("ANULADOR")) {
      return { error: "No tienes permiso para anular órdenes de compra." };
    }

    const orden = await prisma.ordenCompra.findUnique({ where: { id } });
    if (!orden) return { error: "La orden ya no existe." };
    if (orden.estado === "RECHAZADO" || orden.estado === "ANULADO") {
      return { error: "Esta orden ya no está activa." };
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

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    revalidatePath("/logistica/solicitudes-pedido");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en anularOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al anular la orden." };
  }
}
