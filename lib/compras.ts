import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ROLES, type RolNombre } from "@/lib/auth/constants";
import { maximoNumero } from "@/lib/utils";
import {
  TIPO_CAMBIO_USD_APROBACION,
  PREFIJO_ORDEN,
  CORRELATIVO_INICIAL_ORDEN,
  type AreaEmpresaCodigo,
  type CategoriaCompraCodigo,
  type RolAprobadorEspecialCodigo,
} from "@/lib/constants/compras";

// Siguiente número de OC/OS de una categoría: igual que siguienteNumero
// (lib/utils.ts), pero con un piso de CORRELATIVO_INICIAL_ORDEN en vez de
// 1, para continuar la numeración que ya se usaba fuera del sistema.
export function siguienteNumeroOrden(numerosExistentes: string[], categoria: CategoriaCompraCodigo): string {
  const prefijo = PREFIJO_ORDEN[categoria];
  const siguiente = Math.max(maximoNumero(numerosExistentes, prefijo), CORRELATIVO_INICIAL_ORDEN - 1) + 1;
  return `${prefijo}${String(siguiente).padStart(9, "0")}`;
}

type Db = PrismaClient | Prisma.TransactionClient;

// Único permiso habilitado para "cerrar posición" (Solped y OC/OS) y para
// crear/editar Órdenes de compra y servicio (ver RolNombre.COMPRADORES).
// ADMIN siempre lo cumple, como con cualquier otro permiso del sistema.
export function esComprador(usuario: { roles: RolNombre[] }): boolean {
  return usuario.roles.includes(ROLES.ADMIN) || usuario.roles.includes(ROLES.COMPRADORES);
}

// Valor "Packing" de la lista de Campo (ver lib/listas.ts, CAMPO): solo lo
// deben poder ver/elegir los compradores y Carlos Gozzer (aprobador de
// Supply Chain) — pedido explícito del cliente, 2026-11-12. Usa el mismo
// email que EMAIL_APROBADOR_GENERAL_ACOTADO_A_SU_AREA más abajo.
export function puedeVerCampoPacking(usuario: { roles: RolNombre[]; email: string }): boolean {
  return esComprador(usuario) || usuario.email === EMAIL_APROBADOR_GENERAL_ACOTADO_A_SU_AREA;
}

export type ItemPendiente = {
  id: string; // SolicitudPedidoItem.id
  skuId: string;
  codigo: string;
  descripcion: string;
  cantidad: number; // cantidad solicitada originalmente
  cantidadJalada: number;
  cantidadPendiente: number;
  unidadMedida: string;
  centroCosto: string;
  campo: string | null;
  // Solo para categoría Servicio: detalle puntual del servicio (el campo
  // `descripcion` de arriba es el nombre del SKU, p. ej. "Apicultura").
  descripcionServicio: string | null;
};

export type SolicitudConPendientes = {
  id: string;
  numero: string;
  categoria: CategoriaCompraCodigo;
  area: string;
  fecha: Date;
  fechaNecesidad: Date;
  tipoNecesidad: string;
  solicitanteId: string | null;
  justificacion: string | null;
  items: ItemPendiente[];
};

// Cantidad "jalada" de un SolicitudPedidoItem = suma de OrdenCompraItem.cantidad
// de todas las OC que lo referencian, EXCLUYENDO las rechazadas/anuladas (esas
// liberan la cantidad de vuelta al pool de pendientes). Pendiente = cantidad
// solicitada - jalada. Solo se listan solicitudes con al menos un item con
// pendiente > 0, y solo esos items (los ya completados no aparecen).
//
// `categoria`, si se pasa, restringe a solicitudes COMPRA o SERVICIO: una OC
// solo puede jalar de solicitudes COMPRA, una OS solo de SERVICIO, nunca
// mezcladas en un mismo documento.
export async function calcularSolicitudesConPendientes(
  db: Db = prisma,
  categoria?: CategoriaCompraCodigo
): Promise<SolicitudConPendientes[]> {
  // Solo las solicitudes APROBADAS pueden jalarse hacia una OC: las que
  // están en borrador/pendiente de aprobación o fueron rechazadas, no.
  const solicitudes = await db.solicitudPedido.findMany({
    where: { estado: "APROBADO", ...(categoria ? { categoria } : {}) },
    include: { items: { include: { sku: true } } },
    orderBy: { fecha: "asc" },
  });

  const itemIds = solicitudes.flatMap((s) => s.items.map((i) => i.id));
  if (itemIds.length === 0) return [];

  const jaladoPorItem = await db.ordenCompraItem.groupBy({
    by: ["solicitudPedidoItemId"],
    where: {
      solicitudPedidoItemId: { in: itemIds },
      ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } },
    },
    _sum: { cantidad: true },
  });
  const jaladoMap = new Map(jaladoPorItem.map((j) => [j.solicitudPedidoItemId as string, Number(j._sum.cantidad ?? 0)]));

  const resultado: SolicitudConPendientes[] = [];
  for (const solicitud of solicitudes) {
    const items: ItemPendiente[] = [];
    for (const item of solicitud.items) {
      // Una línea RECHAZADA (ver EstadoItemSolicitud) o con la posición
      // cerrada (ver esComprador) nunca está disponible para jalar a una
      // OC, sin importar cuánto quede sin jalar.
      if (item.estado === "RECHAZADO" || item.cerrado) continue;
      const cantidad = Number(item.cantidad);
      const cantidadJalada = jaladoMap.get(item.id) ?? 0;
      const cantidadPendiente = Math.round((cantidad - cantidadJalada) * 1000) / 1000;
      if (cantidadPendiente <= 0) continue;
      items.push({
        id: item.id,
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        cantidad,
        cantidadJalada,
        cantidadPendiente,
        unidadMedida: item.unidadMedida,
        centroCosto: item.centroCosto,
        campo: item.campo,
        descripcionServicio: item.descripcion,
      });
    }
    if (items.length === 0) continue;
    resultado.push({
      id: solicitud.id,
      numero: solicitud.numero,
      categoria: solicitud.categoria as CategoriaCompraCodigo,
      area: solicitud.area,
      fecha: solicitud.fecha,
      fechaNecesidad: solicitud.fechaNecesidad,
      tipoNecesidad: solicitud.tipoNecesidad,
      solicitanteId: solicitud.solicitanteId,
      justificacion: solicitud.justificacion,
      items,
    });
  }
  return resultado;
}

// Pendiente de UN item puntual, usado para validar en el momento de guardar
// una OC (dentro de la misma transacción, para evitar condiciones de
// carrera entre dos personas jalando el mismo item a la vez). Devuelve 0 si
// la solicitud dueña del item no está APROBADA o si la línea puntual fue
// RECHAZADA, mismo criterio que calcularSolicitudesConPendientes.
export async function cantidadPendiente(solicitudPedidoItemId: string, db: Db = prisma): Promise<number> {
  const item = await db.solicitudPedidoItem.findUnique({
    where: { id: solicitudPedidoItemId },
    include: { solicitudPedido: true },
  });
  if (!item || item.solicitudPedido.estado !== "APROBADO" || item.estado === "RECHAZADO" || item.cerrado) return 0;
  const jalado = await db.ordenCompraItem.aggregate({
    where: { solicitudPedidoItemId, ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } } },
    _sum: { cantidad: true },
  });
  return Number(item.cantidad) - Number(jalado._sum.cantidad ?? 0);
}

// Categoría (COMPRA/SERVICIO) de la solicitud dueña de un item, usada para
// impedir que una misma OC/OS mezcle items de ambas categorías.
export async function categoriaDeItem(
  solicitudPedidoItemId: string,
  db: Db = prisma
): Promise<CategoriaCompraCodigo | null> {
  const item = await db.solicitudPedidoItem.findUnique({
    where: { id: solicitudPedidoItemId },
    include: { solicitudPedido: { select: { categoria: true } } },
  });
  return item ? (item.solicitudPedido.categoria as CategoriaCompraCodigo) : null;
}

export type AprobadorAreaInfo = {
  area: AreaEmpresaCodigo;
  usuarioId: string;
  nombre: string;
  email: string;
};

// Mapa área -> usuario responsable de aprobar las solicitudes de pedido de
// esa área (p. ej. el Gerente de Producción aprueba las de PRODUCCION).
export async function obtenerAprobadoresArea(db: Db = prisma): Promise<AprobadorAreaInfo[]> {
  const aprobadores = await db.aprobadorArea.findMany();
  if (aprobadores.length === 0) return [];
  const usuarios = await db.usuario.findMany({
    where: { id: { in: aprobadores.map((a) => a.usuarioId) } },
  });
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  return aprobadores
    .map((a) => {
      const usuario = usuarioPorId.get(a.usuarioId);
      if (!usuario) return null;
      return {
        area: a.area as AreaEmpresaCodigo,
        usuarioId: usuario.id,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        email: usuario.email,
      };
    })
    .filter((a): a is AprobadorAreaInfo => a !== null);
}

// Carlos Gozzer (Gerente de Supply Chain) tiene el rol APROBADOR_GENERAL
// por las Órdenes de Compra/Servicio (ver rolesFirmaRequeridos y
// AprobadorEspecial más abajo, que no cambian por esto), pero para
// Solicitudes de pedido su alcance debe quedar acotado solo a su propia
// área (SUPPLY_CHAIN) — pedido explícito del cliente, no una limitación
// general del rol.
const EMAIL_APROBADOR_GENERAL_ACOTADO_A_SU_AREA = "carlos.gozzer@rpb.interno";

// Un ADMIN puede aprobar/rechazar cualquier solicitud, de cualquier área.
// Un APROBADOR_GENERAL (Gerente de Supply, District Controller, Gerente
// General) también, salvo el caso de arriba; cualquier otro usuario solo
// puede hacerlo si es el aprobador configurado para esa área puntual (lo
// que ya cubre a Carlos Gozzer para SUPPLY_CHAIN).
export function puedeAprobarSolicitud({
  usuarioId,
  email,
  roles,
  area,
  aprobadoresPorArea,
}: {
  usuarioId: string;
  email: string;
  roles: RolNombre[];
  area: string;
  aprobadoresPorArea: Map<string, string>;
}): boolean {
  if (roles.includes(ROLES.ADMIN)) return true;
  if (roles.includes(ROLES.APROBADOR_GENERAL) && email !== EMAIL_APROBADOR_GENERAL_ACOTADO_A_SU_AREA) return true;
  return aprobadoresPorArea.get(area) === usuarioId;
}

export type AprobadorEspecialInfo = {
  rol: RolAprobadorEspecialCodigo;
  usuarioId: string;
  nombre: string;
  email: string;
  enVacaciones: boolean;
};

// Mapa rol especial -> usuario que lo ocupa (ver AprobadorEspecial).
export async function obtenerAprobadoresEspeciales(db: Db = prisma): Promise<AprobadorEspecialInfo[]> {
  const aprobadores = await db.aprobadorEspecial.findMany();
  if (aprobadores.length === 0) return [];
  const usuarios = await db.usuario.findMany({
    where: { id: { in: aprobadores.map((a) => a.usuarioId) } },
  });
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  return aprobadores
    .map((a) => {
      const usuario = usuarioPorId.get(a.usuarioId);
      if (!usuario) return null;
      return {
        rol: a.rol as RolAprobadorEspecialCodigo,
        usuarioId: usuario.id,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        email: usuario.email,
        enVacaciones: usuario.enVacaciones,
      };
    })
    .filter((a): a is AprobadorEspecialInfo => a !== null);
}

// Cadena de reemplazo por vacaciones (pedido explícito, 2026-11-25): si el
// titular de un rol está de vacaciones, el siguiente de esta lista pasa a
// firmar/liberar en su lugar — Gerente General es el techo, sin reemplazo
// propio. Gerente de RRHH queda fuera (no se pidió reemplazo para ese rol).
const CADENA_REEMPLAZO_APROBACION: RolAprobadorEspecialCodigo[] = [
  "GERENTE_SUPPLY",
  "DISTRICT_CONTROLLER",
  "GERENTE_GENERAL",
];

// Quién debe resolver, HOY, la firma de un rol especial puntual — el
// propio titular, o quien lo reemplaza según CADENA_REEMPLAZO_APROBACION
// si está de vacaciones (y también su reemplazo, en cascada, hasta
// Gerente General). Reemplaza el viejo `aprobadorPorRol.get(f.rol)` en
// todos los puntos que deciden "¿puede este usuario firmar este rol?"
// (ver firmarOrdenCompraAction, el detalle y el listado de OC, y las
// notificaciones).
export function resolverAprobadorEfectivo(
  rol: RolAprobadorEspecialCodigo,
  aprobadores: AprobadorEspecialInfo[]
): AprobadorEspecialInfo | undefined {
  const porRol = new Map(aprobadores.map((a) => [a.rol, a]));
  const idx = CADENA_REEMPLAZO_APROBACION.indexOf(rol);
  if (idx === -1) return porRol.get(rol);

  for (let i = idx; i < CADENA_REEMPLAZO_APROBACION.length; i++) {
    const candidato = porRol.get(CADENA_REEMPLAZO_APROBACION[i]);
    if (candidato && !candidato.enVacaciones) return candidato;
  }
  // Todos los de la cadena (desde `rol` hacia arriba) están de vacaciones,
  // o sin asignar: se queda en el techo (Gerente General), sin más reemplazo.
  return porRol.get(CADENA_REEMPLAZO_APROBACION[CADENA_REEMPLAZO_APROBACION.length - 1]) ?? porRol.get(rol);
}

// Convierte un monto a su equivalente en USD solo para ubicar en qué tramo
// de aprobación cae una OC/OS (ver rolesFirmaRequeridos) — no es un tipo de
// cambio contable, es fijo y solo para este propósito.
export function montoEnUsd(monto: number, moneda: string): number {
  return moneda === "PEN" ? monto / TIPO_CAMBIO_USD_APROBACION : monto;
}

// Roles que deben firmar una OC/OS antes de quedar aprobada, según su
// monto (en USD equivalente) y si alguna de sus líneas es de RRHH:
// - Cualquier línea de RRHH: siempre necesita al Gerente de RRHH, además
//   de lo que corresponda por monto.
// - Menos de $10,000: Gerente de Supply.
// - De $10,000 a $50,000: District Controller y Gerente de Supply.
// - Más de $50,000: Gerente de Supply, District Controller y Gerente General.
export function rolesFirmaRequeridos(montoUsd: number, centroCostos: string[]): RolAprobadorEspecialCodigo[] {
  const roles: RolAprobadorEspecialCodigo[] = [];
  if (centroCostos.includes("RRHH")) roles.push("GERENTE_RRHH");
  if (montoUsd < 10000) {
    roles.push("GERENTE_SUPPLY");
  } else if (montoUsd <= 50000) {
    roles.push("DISTRICT_CONTROLLER", "GERENTE_SUPPLY");
  } else {
    roles.push("GERENTE_SUPPLY", "DISTRICT_CONTROLLER", "GERENTE_GENERAL");
  }
  return [...new Set(roles)];
}
