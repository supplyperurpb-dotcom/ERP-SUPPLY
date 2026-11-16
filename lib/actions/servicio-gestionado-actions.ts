"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { esComprador } from "@/lib/compras";
import { subirArchivo } from "@/lib/storage";

export type ServicioGestionadoActionState = { error?: string } | undefined;
export type TipoRegistroAvanceInput = "PORCENTUAL" | "CANTIDAD";

const TIPOS_SUSTENTO_PERMITIDOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

async function rutaRegistro(registroAvanceId: string) {
  const registro = await prisma.registroAvance.findUnique({
    where: { id: registroAvanceId },
    include: { servicioGestionado: true },
  });
  if (!registro) return null;
  return { registro, ruta: `/logistica/gestion-servicios/${registro.servicioGestionado.ordenCompraId}/registro/${registro.numero}` };
}

// Recalcula el estado del RegistroAvance completo a partir del estadoVB
// de sus líneas — pedido explícito: mezcla de aprobadas/rechazadas =
// APROBADO_PARCIAL (no RECHAZADO a secas). Si alguna línea volvió a
// quedar PENDIENTE (recién decidida la primera vez, o reabierta para
// editar), el registro vuelve/permanece en PENDIENTE_VB.
async function recalcularEstadoRegistro(registroAvanceId: string, usuarioId: string) {
  const lineas = await prisma.itemRegistroAvance.findMany({ where: { registroAvanceId }, select: { estadoVB: true } });
  if (lineas.some((l) => l.estadoVB === "PENDIENTE")) {
    await prisma.registroAvance.update({ where: { id: registroAvanceId }, data: { estado: "PENDIENTE_VB" } });
    return;
  }
  const todasAprobadas = lineas.every((l) => l.estadoVB === "APROBADO");
  const todasRechazadas = lineas.every((l) => l.estadoVB === "RECHAZADO");
  const estado = todasAprobadas ? "APROBADO" : todasRechazadas ? "RECHAZADO" : "APROBADO_PARCIAL";
  await prisma.registroAvance.update({
    where: { id: registroAvanceId },
    data: { estado, decididoPorId: usuarioId, fechaDecision: new Date() },
  });
}

// La OS se cierra sola solo cuando el saldo de TODAS sus líneas llega a
// cero contando únicamente avances con estadoVB = APROBADO (uno
// PENDIENTE o RECHAZADO no cuenta, aunque la cantidad ya esté
// registrada) — pedido explícito. Se reabre sola si el saldo aprobado
// vuelve a quedar por encima de cero (ej. se reabre una línea ya
// aprobada para editarla, ver reabrirItemParaEdicionAction).
async function recalcularCierreServicio(servicioGestionadoId: string) {
  const servicio = await prisma.servicioGestionado.findUnique({
    where: { id: servicioGestionadoId },
    include: { ordenCompra: { include: { items: true } } },
  });
  if (!servicio) return;

  const itemIds = servicio.ordenCompra.items.map((i) => i.id);
  const itemsAprobados = itemIds.length
    ? await prisma.itemRegistroAvance.findMany({
        where: { ordenCompraItemId: { in: itemIds }, estadoVB: "APROBADO" },
        include: { avances: true },
      })
    : [];
  const aprobadoPorItem = new Map<string, number>();
  for (const ig of itemsAprobados) {
    const suma = ig.avances.reduce((acc, a) => acc + Number(a.cantidad), 0);
    aprobadoPorItem.set(ig.ordenCompraItemId, (aprobadoPorItem.get(ig.ordenCompraItemId) ?? 0) + suma);
  }
  const saldoAprobadoTotal = servicio.ordenCompra.items.reduce((acc, item) => {
    const cantidadTotal = Number(item.cantidad);
    const aprobado = aprobadoPorItem.get(item.id) ?? 0;
    return acc + Math.max(cantidadTotal - aprobado, 0);
  }, 0);

  const debeEstarCerrado = servicio.ordenCompra.items.length > 0 && saldoAprobadoTotal <= 0.001;
  if (debeEstarCerrado !== servicio.cerrado) {
    await prisma.servicioGestionado.update({
      where: { id: servicioGestionadoId },
      data: { cerrado: debeEstarCerrado, fechaCierre: debeEstarCerrado ? new Date() : null },
    });
  }
}

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
    if (itemGestionado.estadoVB !== "PENDIENTE") {
      return { error: "Esta línea ya fue decidida. Usa \"Editar\" para volver a habilitarla." };
    }

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

// Cierra la edición del registro (ya no se puede añadir ítems, registrar
// avance ni tocar sustentos) — pedido explícito, habilita "Solicitar VB".
export async function culminarRegistroAvanceAction(registroAvanceId: string): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };

    const datos = await rutaRegistro(registroAvanceId);
    if (!datos) return { error: "Este registro de avance ya no existe." };
    if (datos.registro.estado !== "ABIERTO") return { error: "Este registro ya fue culminado." };

    await prisma.registroAvance.update({ where: { id: registroAvanceId }, data: { estado: "CULMINADO" } });
    revalidatePath(datos.ruta);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en culminarRegistroAvanceAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al culminar el registro." };
  }
}

// Sube el archivo de UN sustento (mismo patrón que subirGuiaRemisionIngresoAction
// en ingreso-almacen-actions.ts) — el registro en la base de datos lo hace
// agregarSustentoRegistroAvanceAction, recién con la ruta ya subida.
export async function subirArchivoSustentoAction(formData: FormData): Promise<{ path?: string; nombreArchivo?: string; error?: string }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo." };
  }
  if (!TIPOS_SUSTENTO_PERMITIDOS.includes(archivo.type)) {
    return { error: "Formato no permitido. Sube un PDF, Word, Excel o una foto." };
  }
  if (archivo.size > 15 * 1024 * 1024) {
    return { error: "El archivo no puede superar 15 MB." };
  }

  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Debes iniciar sesión." };

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "bin";
  const ruta = `gestion-servicios/sustentos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  try {
    const path = await subirArchivo(ruta, archivo);
    return { path, nombreArchivo: archivo.name };
  } catch (e) {
    console.error("Error subiendo sustento:", e);
    return { error: e instanceof Error ? e.message : "No se pudo subir el archivo." };
  }
}

// Crea el sustento Nro {siguiente correlativo} con el archivo YA subido
// (ver subirArchivoSustentoAction) — solo 1 archivo por sustento, pedido
// explícito; otro archivo va en OTRO sustento.
export async function agregarSustentoRegistroAvanceAction(
  registroAvanceId: string,
  descripcion: string,
  archivo: string,
  nombreArchivo: string
): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };
    if (!descripcion.trim()) return { error: "Escribe una descripción del sustento." };

    const datos = await rutaRegistro(registroAvanceId);
    if (!datos) return { error: "Este registro de avance ya no existe." };
    if (datos.registro.estado !== "ABIERTO") return { error: "Este registro ya no se puede editar." };

    const ultimo = await prisma.sustentoRegistroAvance.findFirst({ where: { registroAvanceId }, orderBy: { numero: "desc" } });
    const numero = (ultimo?.numero ?? 0) + 1;

    await prisma.sustentoRegistroAvance.create({
      data: { registroAvanceId, numero, descripcion: descripcion.trim(), archivo, nombreArchivo, creadoPorId: usuario.id },
    });

    revalidatePath(datos.ruta);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en agregarSustentoRegistroAvanceAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al añadir el sustento." };
  }
}

// Elimina un sustento y renumera los siguientes de ese mismo registro
// para no dejar huecos (sustento 3 pasa a ser el 2, etc.) — pedido
// explícito.
export async function eliminarSustentoRegistroAvanceAction(sustentoId: string): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };

    const sustento = await prisma.sustentoRegistroAvance.findUnique({
      where: { id: sustentoId },
      include: { registroAvance: { include: { servicioGestionado: true } } },
    });
    if (!sustento) return { error: "Este sustento ya no existe." };
    if (sustento.registroAvance.estado !== "ABIERTO") return { error: "Este registro ya no se puede editar." };

    await prisma.$transaction(async (tx) => {
      await tx.sustentoRegistroAvance.delete({ where: { id: sustentoId } });
      const siguientes = await tx.sustentoRegistroAvance.findMany({
        where: { registroAvanceId: sustento.registroAvanceId, numero: { gt: sustento.numero } },
        orderBy: { numero: "asc" },
      });
      for (const s of siguientes) {
        await tx.sustentoRegistroAvance.update({ where: { id: s.id }, data: { numero: s.numero - 1 } });
      }
    });

    revalidatePath(
      `/logistica/gestion-servicios/${sustento.registroAvance.servicioGestionado.ordenCompraId}/registro/${sustento.registroAvance.numero}`
    );
    return undefined;
  } catch (e) {
    console.error("Error inesperado en eliminarSustentoRegistroAvanceAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al eliminar el sustento." };
  }
}

// Envía el registro CULMINADO al usuario elegido para que dé su VB.
export async function solicitarVbRegistroAvanceAction(
  registroAvanceId: string,
  aprobadorId: string
): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };
    if (!aprobadorId) return { error: "Selecciona a quién le pides el VB." };

    const datos = await rutaRegistro(registroAvanceId);
    if (!datos) return { error: "Este registro de avance ya no existe." };
    if (datos.registro.estado !== "CULMINADO") return { error: "Primero debes culminar el registro." };

    const aprobador = await prisma.usuario.findUnique({ where: { id: aprobadorId } });
    if (!aprobador) return { error: "El usuario seleccionado ya no existe." };

    await prisma.registroAvance.update({
      where: { id: registroAvanceId },
      data: { estado: "PENDIENTE_VB", aprobadorId },
    });

    revalidatePath(datos.ruta);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en solicitarVbRegistroAvanceAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al solicitar el VB." };
  }
}

// Resuelve el VB — observaciones obligatorias solo al rechazar, pedido
// explícito. Solo lo puede hacer el usuario al que se le pidió, o un
// ADMIN (mismo criterio de respaldo que el resto de flujos de aprobación
// de este ERP, ver firmarOrdenCompraAction). Pedido explícito: una línea
// ya RECHAZADA, el mismo aprobador la puede revertir a APROBADO más
// adelante (aunque el registro ya no esté PENDIENTE_VB) — ningún otro
// cambio de decisión está permitido fuera de PENDIENTE_VB.
export async function decidirVbItemAction(
  itemRegistroAvanceId: string,
  decision: "APROBADO" | "RECHAZADO",
  observaciones: string | undefined
): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };
    if (decision === "RECHAZADO" && !observaciones?.trim()) {
      return { error: "Las observaciones son obligatorias para rechazar." };
    }

    const item = await prisma.itemRegistroAvance.findUnique({
      where: { id: itemRegistroAvanceId },
      include: { registroAvance: { include: { servicioGestionado: true } } },
    });
    if (!item) return { error: "Esta línea ya no existe." };
    const registro = item.registroAvance;

    const esAdmin = usuario.roles.includes("ADMIN");
    if (registro.aprobadorId !== usuario.id && !esAdmin) {
      return { error: "No te corresponde dar el VB de este registro." };
    }

    if (item.estadoVB === "PENDIENTE") {
      if (registro.estado !== "PENDIENTE_VB") return { error: "Este registro no está pendiente de VB." };
    } else if (item.estadoVB === "RECHAZADO" && decision === "APROBADO") {
      // Revertir una línea rechazada: permitido en cualquier momento.
    } else {
      return { error: "Esta línea ya fue decidida." };
    }

    await prisma.itemRegistroAvance.update({
      where: { id: itemRegistroAvanceId },
      data: {
        estadoVB: decision,
        observacionesVB: observaciones?.trim() || null,
        decididoPorId: usuario.id,
        fechaDecisionVB: new Date(),
      },
    });

    await recalcularEstadoRegistro(registro.id, usuario.id);
    await recalcularCierreServicio(registro.servicioGestionadoId);

    revalidatePath(`/logistica/gestion-servicios/${registro.servicioGestionado.ordenCompraId}/registro/${registro.numero}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en decidirVbItemAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al resolver el VB." };
  }
}

// Reabre una línea ya decidida (aprobada o rechazada) para poder corregir
// su avance — pedido explícito: exclusivo del Comprador que gestiona la
// OS, y SOLO esa línea vuelve a pedir VB (no hace falta "Solicitar VB" de
// nuevo para todo el registro: ya tiene su aprobador asignado, el
// registro completo vuelve a PENDIENTE_VB para que la revise otra vez).
export async function reabrirItemParaEdicionAction(itemRegistroAvanceId: string): Promise<ServicioGestionadoActionState> {
  try {
    const usuario = await getUsuarioActual();
    if (!usuario) return { error: "Debes iniciar sesión." };
    if (!esComprador(usuario)) return { error: "Solo un Comprador puede editar una línea ya decidida." };

    const item = await prisma.itemRegistroAvance.findUnique({
      where: { id: itemRegistroAvanceId },
      include: { registroAvance: { include: { servicioGestionado: true } } },
    });
    if (!item) return { error: "Esta línea ya no existe." };
    if (item.estadoVB === "PENDIENTE") return { error: "Esta línea ya está habilitada para editar." };

    await prisma.itemRegistroAvance.update({
      where: { id: itemRegistroAvanceId },
      data: { estadoVB: "PENDIENTE", observacionesVB: null, decididoPorId: null, fechaDecisionVB: null },
    });

    const registro = item.registroAvance;
    await prisma.registroAvance.update({ where: { id: registro.id }, data: { estado: "PENDIENTE_VB" } });
    await recalcularCierreServicio(registro.servicioGestionadoId);

    revalidatePath(`/logistica/gestion-servicios/${registro.servicioGestionado.ordenCompraId}/registro/${registro.numero}`);
    return undefined;
  } catch (e) {
    console.error("Error inesperado en reabrirItemParaEdicionAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al habilitar la edición." };
  }
}
