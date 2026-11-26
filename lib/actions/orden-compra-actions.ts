"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import type { RolNombre } from "@/lib/auth/constants";
import { siguienteNumero } from "@/lib/utils";
import { subirArchivo } from "@/lib/storage";
import { IGV_TASA, PREFIJO_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import {
  cantidadPendiente,
  categoriaDeItem,
  esComprador,
  montoEnUsd,
  obtenerAprobadoresEspeciales,
  resolverAprobadorEfectivo,
  rolesFirmaRequeridos,
} from "@/lib/compras";
import {
  ordenCompraSchema,
  editarOrdenCompraSchema,
  ordenCompraDirectaSchema,
  type OrdenCompraInput,
  type EditarOrdenCompraInput,
  type OrdenCompraDirectaInput,
} from "@/lib/validations/compras";

export type OrdenCompraActionState = { error?: string; id?: string } | undefined;

// Tipos permitidos para el sustento adjunto al generar la orden (pedido
// explícito, 2026-11-25): PDF, Word, Excel o una imagen — nunca un
// ejecutable u otro formato arbitrario.
const TIPOS_SUSTENTO_PERMITIDOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Sube el sustento ANTES de crear la orden (el formulario arma el payload
// a mano, no FormData — ver orden-compra-form.tsx/orden-compra-directa-
// form.tsx): devuelve la ruta en el bucket privado para que el submit
// final la incluya como archivo/nombreArchivo en crearOrdenCompra(Directa)Action.
export async function subirArchivoSustentoOrdenAction(
  formData: FormData
): Promise<{ path?: string; nombreArchivo?: string; error?: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Selecciona un archivo." };
  if (!TIPOS_SUSTENTO_PERMITIDOS.includes(archivo.type)) {
    return { error: "Formato no permitido. Sube un PDF, Word, Excel o una imagen." };
  }
  if (archivo.size > 15 * 1024 * 1024) return { error: "El archivo no puede superar 15 MB." };

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión." };

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "bin";
  const ruta = `ordenes-compra/sustentos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  try {
    const path = await subirArchivo(ruta, archivo);
    return { path, nombreArchivo: archivo.name };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }
}

export async function crearOrdenCompraAction(data: OrdenCompraInput): Promise<OrdenCompraActionState> {
  const parsed = ordenCompraSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    proveedorId,
    tipoOrden,
    vigenteHasta,
    fecha,
    hora,
    fechaEntrega,
    condicionPago,
    lugarEntrega,
    observaciones,
    moneda,
    items,
    archivo,
    nombreArchivo,
  } = parsed.data;

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión para crear una orden." };
  if (!esComprador(usuario)) return { error: "Solo un Comprador puede crear órdenes de compra/servicio." };

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

      const existentes = await tx.ordenCompra.findMany({ where: { categoria, tipoOrden }, select: { numero: true } });
      const numero = siguienteNumero(existentes.map((o) => o.numero), PREFIJO_ORDEN[categoria][tipoOrden], 9);

      const orden = await tx.ordenCompra.create({
        data: {
          numero,
          categoria,
          tipoOrden,
          vigenteHasta: tipoOrden === "ABIERTA" ? vigenteHasta : null,
          proveedorId,
          // Nace en BORRADOR (editable, nadie la firmó aún) — pasa a
          // PENDIENTE recién con la primera firma (ver firmarOrdenCompraAction).
          estado: "BORRADOR",
          fecha,
          hora: hora || null,
          fechaEntrega: fechaEntrega || null,
          condicionPago: condicionPago || null,
          lugarEntrega: lugarEntrega || null,
          observaciones: observaciones || null,
          moneda,
          subtotal,
          igv: igvRedondeado,
          montoTotal,
          creadoPorId: usuario?.id,
          archivo,
          nombreArchivo,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemCreado = await tx.ordenCompraItem.create({
          data: {
            ordenCompraId: orden.id,
            solicitudPedidoItemId: item.solicitudPedidoItemId,
            skuId: item.skuId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: subtotales[i],
            gravado: item.gravado,
            centroCosto: item.centroCosto,
            campo: item.campo || null,
            descripcion: item.descripcion || null,
          },
        });
        // Programa de Entregas (pedido explícito, 2026-11-25): se guarda
        // junto con la línea, en la misma transacción — si algo falla acá,
        // no se guarda ni la OC ni el programa.
        if (item.entregas.length > 0) {
          await tx.ordenCompraEntrega.createMany({
            data: item.entregas.map((e) => ({
              ordenCompraItemId: itemCreado.id,
              cantidad: e.cantidad,
              fechaTentativa: e.fechaTentativa,
              creadoPorId: usuario?.id,
            })),
          });
        }
      }

      // Las firmas requeridas (ver rolesFirmaRequeridos) ya no se crean
      // acá — nacen recién con enviarAprobacionOrdenCompraAction, para que
      // ningún aprobador vea esta orden mientras sigue siendo un borrador
      // que el comprador todavía puede estar editando.
      return orden;
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath("/logistica/programa-entregas");
    return { id: nuevaOrden.id };
  } catch (e) {
    console.error("Error inesperado en crearOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al guardar la orden de compra." };
  }
}

// Orden "directa": igual que crearOrdenCompraAction pero sin ninguna
// Solicitud de Pedido detrás — cada línea trae su propio SKU/centro de
// costo en vez de un solicitudPedidoItemId, así que no hay nada que
// validar contra "lo pendiente" de una solicitud. Sigue el mismo flujo de
// firmas por monto (rolesFirmaRequeridos) que una orden normal.
export async function crearOrdenCompraDirectaAction(data: OrdenCompraDirectaInput): Promise<OrdenCompraActionState> {
  const parsed = ordenCompraDirectaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    categoria,
    tipoOrden,
    vigenteHasta,
    proveedorId,
    fecha,
    hora,
    fechaEntrega,
    condicionPago,
    lugarEntrega,
    observaciones,
    moneda,
    items,
    archivo,
    nombreArchivo,
  } = parsed.data;

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión para crear una orden." };
  if (!esComprador(usuario)) return { error: "Solo un Comprador puede crear órdenes de compra/servicio." };

  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) {
    return { error: "El proveedor seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
  }

  const subtotales = items.map((item) => Math.round(item.cantidad * item.precioUnitario * 100) / 100);
  const subtotal = subtotales.reduce((a, b) => a + b, 0);
  const igv = items.reduce((acc, item, i) => (item.gravado ? acc + subtotales[i] * IGV_TASA : acc), 0);
  const igvRedondeado = Math.round(igv * 100) / 100;
  const montoTotal = Math.round((subtotal + igvRedondeado) * 100) / 100;

  try {
    const nuevaOrden = await prisma.$transaction(async (tx) => {
      const existentes = await tx.ordenCompra.findMany({ where: { categoria, tipoOrden }, select: { numero: true } });
      const numero = siguienteNumero(existentes.map((o) => o.numero), PREFIJO_ORDEN[categoria][tipoOrden], 9);

      const orden = await tx.ordenCompra.create({
        data: {
          numero,
          categoria,
          tipoOrden,
          vigenteHasta: tipoOrden === "ABIERTA" ? vigenteHasta : null,
          proveedorId,
          // Nace en BORRADOR igual que una orden normal — pasa a PENDIENTE
          // recién con la primera firma (ver firmarOrdenCompraAction).
          estado: "BORRADOR",
          fecha,
          hora: hora || null,
          fechaEntrega: fechaEntrega || null,
          condicionPago: condicionPago || null,
          lugarEntrega: lugarEntrega || null,
          observaciones: observaciones || null,
          moneda,
          subtotal,
          igv: igvRedondeado,
          montoTotal,
          creadoPorId: usuario?.id,
          archivo,
          nombreArchivo,
        },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemCreado = await tx.ordenCompraItem.create({
          data: {
            ordenCompraId: orden.id,
            skuId: item.skuId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: subtotales[i],
            gravado: item.gravado,
            centroCosto: item.centroCosto,
            campo: item.campo || null,
            descripcion: item.descripcion || null,
          },
        });
        // Programa de Entregas: ver mismo comentario en crearOrdenCompraAction.
        if (item.entregas.length > 0) {
          await tx.ordenCompraEntrega.createMany({
            data: item.entregas.map((e) => ({
              ordenCompraItemId: itemCreado.id,
              cantidad: e.cantidad,
              fechaTentativa: e.fechaTentativa,
              creadoPorId: usuario?.id,
            })),
          });
        }
      }

      // Igual que en crearOrdenCompraAction: las firmas nacen recién al
      // enviar la orden a aprobación, no al crearla.
      return orden;
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath("/logistica/programa-entregas");
    return { id: nuevaOrden.id };
  } catch (e) {
    console.error("Error inesperado en crearOrdenCompraDirectaAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al guardar la orden directa." };
  }
}

// Saca la orden del estado "borrador invisible para aprobadores" y crea
// las firmas requeridas (ver rolesFirmaRequeridos) recién en este momento
// — pedido explícito: nadie del lado de aprobación debe ver ni poder
// actuar sobre la orden hasta que el comprador la envíe a propósito.
// Solo aplica a una orden recién creada (BORRADOR sin ninguna firma
// todavía); una orden que volvió a BORRADOR porque se deshizo una firma
// (ver anularFirmaOrdenCompraAction) ya tiene sus firmas y no pasa por acá.
export async function enviarAprobacionOrdenCompraAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para enviar la orden a aprobación." };

    const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { items: true, firmas: true } });
    if (!orden) return { error: "La orden ya no existe." };
    if (!puedeEditarOrden(usuario, orden)) {
      return { error: "No tienes permiso para enviar esta orden a aprobación." };
    }
    if (orden.estado !== "BORRADOR") {
      return { error: "Esta orden ya fue enviada a aprobación." };
    }
    if (orden.firmas.length > 0) {
      return { error: "Esta orden ya tiene firmas registradas." };
    }
    if (orden.items.length === 0) {
      return { error: "Agrega al menos un ítem antes de enviar la orden a aprobación." };
    }

    const centroCostos = [...new Set(orden.items.map((i) => i.centroCosto))];
    const roles = rolesFirmaRequeridos(montoEnUsd(Number(orden.montoTotal), orden.moneda), centroCostos);

    await prisma.$transaction(async (tx) => {
      for (const rol of roles) {
        await tx.ordenCompraFirma.create({ data: { ordenCompraId: id, rol } });
      }
      await tx.ordenCompra.update({ where: { id }, data: { estado: "PENDIENTE" } });
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en enviarAprobacionOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al enviar la orden a aprobación." };
  }
}

// Reemplaza al antiguo aprobar/rechazar de un solo clic por ADMIN: cada OC/OS
// tiene una o más firmas requeridas (ver rolesFirmaRequeridos, calculadas al
// enviarla a aprobación) y cada una la resuelve el titular de ese rol
// especial (o un ADMIN, como respaldo). La orden entera queda APROBADA
// recién cuando todas sus firmas están en APROBADO; si cualquiera se
// RECHAZA, la orden completa pasa a RECHAZADO de inmediato.
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
    // BORRADOR también se puede firmar: no una recién creada (todavía sin
    // firmas, ver enviarAprobacionOrdenCompraAction), sino una que volvió a
    // BORRADOR porque se deshizo una firma (ver anularFirmaOrdenCompraAction)
    // — ahí sigue teniendo sus firmas, solo que ya no todas aprobadas.
    if (orden.estado !== "BORRADOR" && orden.estado !== "PENDIENTE") {
      return { error: "Solo se pueden firmar órdenes en borrador o pendientes." };
    }

    const firmasPendientes = orden.firmas.filter((f) => f.estado === "PENDIENTE");
    if (firmasPendientes.length === 0) {
      return { error: "Esta orden no tiene firmas pendientes." };
    }

    const aprobadoresEspeciales = await obtenerAprobadoresEspeciales();
    const firmaDelUsuario = firmasPendientes.find(
      (f) => resolverAprobadorEfectivo(f.rol, aprobadoresEspeciales)?.usuarioId === usuario.id
    );
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
// a PENDIENTE (sigue el proceso normal de firmas). Recién cuando la
// última también se deshace (ej. las 3 firmas requeridas se anulan), la
// orden regresa a BORRADOR y se puede editar — y, pedido explícito, en
// ese punto se BORRAN todas sus firmas (no quedan "pendientes" en el
// aire): deja de aparecer para los aprobadores y, para volver a
// necesitar su visto bueno, alguien tiene que enviarla a aprobación de
// nuevo (ver enviarAprobacionOrdenCompraAction), exactamente como una
// orden recién creada.
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
      const quedaAlgunaAprobada = orden.firmas.some((f) => (f.id === firmaId ? false : f.estado === "APROBADO"));

      if (quedaAlgunaAprobada) {
        await tx.ordenCompraFirma.update({
          where: { id: firmaId },
          data: { estado: "PENDIENTE", usuarioId: null, fecha: null, comentario: comentario || null },
        });
      } else {
        // Última firma aprobada que se deshace: se borran todas (ver
        // comentario de la función) en vez de dejarlas resetadas.
        await tx.ordenCompraFirma.deleteMany({ where: { ordenCompraId: id } });
      }

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

// Puede editar: quien la creó, o un Comprador/ADMIN (mismo criterio que
// al crear, porque gestionan órdenes de cualquier área). Pedido explícito
// (2026-11-25): editable en cualquier estado que no sea APROBADO/
// RECHAZADO/ANULADO — incluso ya enviada a aprobación (PENDIENTE), no
// solo en BORRADOR.
function puedeEditarOrden(usuario: { id: string; roles: RolNombre[] }, orden: { creadoPorId: string | null }) {
  return esComprador(usuario) || orden.creadoPorId === usuario.id;
}

// Edita los datos generales y las líneas YA EXISTENTES de una orden en
// BORRADOR o PENDIENTE (no se agregan ni quitan líneas acá — para eso se
// anula y se genera una nueva desde la Solped). Si la orden ya tenía
// firmas (estaba PENDIENTE), se borran y la orden vuelve a BORRADOR —
// mismo criterio que anularFirmaOrdenCompraAction cuando se deshace la
// última firma aprobada — porque el monto editado puede cambiar de tramo
// de aprobación (ver rolesFirmaRequeridos), así que quien edite tiene que
// volver a enviarla a aprobación a propósito, nunca de forma automática
// al guardar.
export async function editarOrdenCompraAction(id: string, data: EditarOrdenCompraInput): Promise<OrdenCompraActionState> {
  const parsed = editarOrdenCompraSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { proveedorId, fecha, hora, fechaEntrega, condicionPago, lugarEntrega, observaciones, moneda, items } = parsed.data;

  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para editar una orden." };

    const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: { items: true } });
    if (!orden) return { error: "La orden ya no existe." };
    if (!puedeEditarOrden(usuario, orden)) {
      return { error: "No tienes permiso para editar esta orden." };
    }
    if (orden.estado !== "BORRADOR" && orden.estado !== "PENDIENTE") {
      return { error: "Esta orden ya no se puede editar (está aprobada, rechazada o anulada)." };
    }

    const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
    if (!proveedor) {
      return { error: "El proveedor seleccionado ya no existe. Actualiza la página e intenta de nuevo." };
    }

    // Las líneas ya existentes no se pueden quitar (solo ajustar) — las
    // que llegan sin id son nuevas y se crean aparte, ver más abajo.
    const idsExistentes = new Set(orden.items.map((i) => i.id));
    const itemsExistentes = items.filter((i) => i.id);
    const itemsNuevos = items.filter((i) => !i.id);
    const idsEnviados = new Set(itemsExistentes.map((i) => i.id!));
    if (idsEnviados.size !== idsExistentes.size || [...idsEnviados].some((itemId) => !idsExistentes.has(itemId))) {
      return { error: "Los ítems de la orden cambiaron desde que abriste esta página. Actualízala e intenta de nuevo." };
    }

    // Si dos líneas nuevas repiten el mismo ítem de solicitud, se valida la suma.
    const cantidadNuevaPorItemSolped = new Map<string, number>();
    for (const item of itemsNuevos) {
      if (!item.solicitudPedidoItemId) continue;
      cantidadNuevaPorItemSolped.set(
        item.solicitudPedidoItemId,
        (cantidadNuevaPorItemSolped.get(item.solicitudPedidoItemId) ?? 0) + item.cantidad
      );
    }

    const subtotalesExistentes = itemsExistentes.map((item) => Math.round(item.cantidad * item.precioUnitario * 100) / 100);
    const subtotalesNuevos = itemsNuevos.map((item) => Math.round(item.cantidad * item.precioUnitario * 100) / 100);
    const subtotal = [...subtotalesExistentes, ...subtotalesNuevos].reduce((a, b) => a + b, 0);
    const igv =
      itemsExistentes.reduce((acc, item, i) => (item.gravado ? acc + subtotalesExistentes[i] * IGV_TASA : acc), 0) +
      itemsNuevos.reduce((acc, item, i) => (item.gravado ? acc + subtotalesNuevos[i] * IGV_TASA : acc), 0);
    const igvRedondeado = Math.round(igv * 100) / 100;
    const montoTotal = Math.round((subtotal + igvRedondeado) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      // Las líneas nuevas que vienen de una Solped deben validarse contra
      // lo pendiente de esa solicitud, igual que al crear la orden — la
      // cantidad que esta MISMA orden ya tenía de esa línea (si la hubiera)
      // no se resta porque es un ítem de solped distinto (uno nuevo no
      // puede repetir el id de uno ya existente en la orden).
      for (const [solicitudPedidoItemId, cantidadSolicitadaAhora] of cantidadNuevaPorItemSolped) {
        const categoriaItem = await categoriaDeItem(solicitudPedidoItemId, tx);
        if (categoriaItem !== null && categoriaItem !== orden.categoria) {
          throw new Error("No se puede agregar un ítem de una solicitud de categoría distinta a la de esta orden.");
        }
        const pendiente = await cantidadPendiente(solicitudPedidoItemId, tx);
        if (cantidadSolicitadaAhora > pendiente) {
          const itemOriginal = await tx.solicitudPedidoItem.findUnique({
            where: { id: solicitudPedidoItemId },
            include: { sku: true, solicitudPedido: true },
          });
          const etiqueta = itemOriginal
            ? `${itemOriginal.sku.codigo} (solicitud ${itemOriginal.solicitudPedido.numero})`
            : solicitudPedidoItemId;
          throw new Error(
            `La cantidad de ${etiqueta} supera lo pendiente (disponible: ${pendiente}, solicitado ahora: ${cantidadSolicitadaAhora}).`
          );
        }
      }

      await tx.ordenCompra.update({
        where: { id },
        data: {
          proveedorId,
          fecha,
          hora: hora || null,
          fechaEntrega: fechaEntrega || null,
          condicionPago: condicionPago || null,
          lugarEntrega: lugarEntrega || null,
          observaciones: observaciones || null,
          moneda,
          subtotal,
          igv: igvRedondeado,
          montoTotal,
          // Si venía PENDIENTE (con firmas, borradas abajo), vuelve a
          // BORRADOR — nunca debe quedar PENDIENTE sin ninguna firma.
          estado: "BORRADOR",
          aprobadoPorId: null,
          fechaAprobacion: null,
          comentarioRechazo: null,
        },
      });

      for (let i = 0; i < itemsExistentes.length; i++) {
        const item = itemsExistentes[i];
        await tx.ordenCompraItem.update({
          where: { id: item.id },
          data: {
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: subtotalesExistentes[i],
            gravado: item.gravado,
            descripcion: item.descripcion || null,
          },
        });
        // Programa de Entregas (pedido explícito, 2026-11-25): al editar se
        // reemplaza el programa completo de la línea por el que llega del
        // paso "Ver plan de entrega" — nunca se "parchea" entrega por
        // entrega, así que se borra y se vuelve a crear, dentro de la
        // misma transacción que el resto de la edición.
        await tx.ordenCompraEntrega.deleteMany({ where: { ordenCompraItemId: item.id! } });
        if (item.entregas.length > 0) {
          await tx.ordenCompraEntrega.createMany({
            data: item.entregas.map((e) => ({
              ordenCompraItemId: item.id!,
              cantidad: e.cantidad,
              fechaTentativa: e.fechaTentativa,
              creadoPorId: usuario.id,
            })),
          });
        }
      }

      for (let i = 0; i < itemsNuevos.length; i++) {
        const item = itemsNuevos[i];
        const itemCreado = await tx.ordenCompraItem.create({
          data: {
            ordenCompraId: id,
            solicitudPedidoItemId: item.solicitudPedidoItemId || null,
            skuId: item.skuId!,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: subtotalesNuevos[i],
            gravado: item.gravado,
            centroCosto: item.centroCosto!,
            campo: item.campo || null,
            descripcion: item.descripcion || null,
          },
        });
        if (item.entregas.length > 0) {
          await tx.ordenCompraEntrega.createMany({
            data: item.entregas.map((e) => ({
              ordenCompraItemId: itemCreado.id,
              cantidad: e.cantidad,
              fechaTentativa: e.fechaTentativa,
              creadoPorId: usuario.id,
            })),
          });
        }
      }

      await tx.ordenCompraFirma.deleteMany({ where: { ordenCompraId: id } });
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    revalidatePath("/logistica/programa-entregas");
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

    await prisma.$transaction(async (tx) => {
      await tx.ordenCompra.update({
        where: { id },
        data: {
          estado: "ANULADO",
          aprobadoPorId: usuario.id,
          fechaAprobacion: new Date(),
          comentarioRechazo: comentario || null,
        },
      });
      // Programa de Entregas (pedido explícito, 2026-11-25): se conserva
      // la trazabilidad, nunca se borra — solo pasa a ANULADA.
      await tx.ordenCompraEntrega.updateMany({
        where: { ordenCompraItem: { ordenCompraId: id } },
        data: { estado: "ANULADA" },
      });
    });

    revalidatePath("/logistica/ordenes-compra");
    revalidatePath(`/logistica/ordenes-compra/${id}`);
    revalidatePath("/logistica/solicitudes-pedido");
    revalidatePath("/logistica/programa-entregas");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en anularOrdenCompraAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al anular la orden." };
  }
}

// Cierra UNA línea de la orden que no va a recibirse más (no llegará, o ya
// no se quiere) — pedido explícito: deja de contar como pendiente en
// cantidadPendienteIngresoOC/calcularOcPendientesIngreso (ver
// lib/stock-almacen.ts), sin tocar el resto de la orden ni sus demás
// líneas. Exclusivo de Compradores/ADMIN (ver esComprador) -- a
// diferencia de editar la orden, acá no basta con ser quien la creó.
export async function cerrarPosicionOrdenCompraItemAction(
  itemId: string,
  motivo?: string
): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para cerrar una posición." };

    const item = await prisma.ordenCompraItem.findUnique({ where: { id: itemId }, include: { ordenCompra: true } });
    if (!item) return { error: "Ese ítem ya no existe." };
    if (!esComprador(usuario)) {
      return { error: "Solo un Comprador puede cerrar posiciones." };
    }
    if (item.cerrado) return { error: "Esta posición ya estaba cerrada." };

    await prisma.ordenCompraItem.update({
      where: { id: itemId },
      data: { cerrado: true, motivoCierre: motivo || null, cerradoPorId: usuario.id, fechaCierre: new Date() },
    });

    revalidatePath(`/logistica/ordenes-compra/${item.ordenCompraId}`);
    revalidatePath("/logistica/almacenes/ingresos/nuevo");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en cerrarPosicionOrdenCompraItemAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al cerrar la posición." };
  }
}

// Reversa de cerrarPosicionOrdenCompraItemAction: la línea vuelve a contar
// como pendiente por lo que todavía le falte recibir.
export async function reabrirPosicionOrdenCompraItemAction(itemId: string): Promise<{ error?: string } | undefined> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión para reabrir una posición." };

    const item = await prisma.ordenCompraItem.findUnique({ where: { id: itemId }, include: { ordenCompra: true } });
    if (!item) return { error: "Ese ítem ya no existe." };
    if (!esComprador(usuario)) {
      return { error: "Solo un Comprador puede reabrir posiciones." };
    }
    if (!item.cerrado) return { error: "Esta posición no estaba cerrada." };

    await prisma.ordenCompraItem.update({
      where: { id: itemId },
      data: { cerrado: false, motivoCierre: null, cerradoPorId: null, fechaCierre: null },
    });

    revalidatePath(`/logistica/ordenes-compra/${item.ordenCompraId}`);
    revalidatePath("/logistica/almacenes/ingresos/nuevo");
    return undefined;
  } catch (e) {
    console.error("Error inesperado en reabrirPosicionOrdenCompraItemAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al reabrir la posición." };
  }
}

// Aprueba varias OC/OS de un solo clic (pedido explícito, 2026-11-25: las
// casillas a la derecha del listado, solo para quien tenga un rol de
// aprobación pendiente en esas órdenes). Reusa firmarOrdenCompraAction
// orden por orden, para que cada una pase por sus mismas validaciones
// (rol propio pendiente, todas-las-firmas-aprobadas, etc.) en vez de
// duplicar esa lógica.
export async function firmarOrdenesCompraMasivoAction(
  ids: string[]
): Promise<{ aprobadas: number; errores: string[] }> {
  const errores: string[] = [];
  let aprobadas = 0;
  for (const id of ids) {
    const resultado = await firmarOrdenCompraAction(id, "APROBADO");
    if (resultado?.error) {
      errores.push(resultado.error);
    } else {
      aprobadas++;
    }
  }
  return { aprobadas, errores };
}
