export const ROLES = {
  ADMIN: "ADMIN",
  LOGISTICA_COMPRAS: "LOGISTICA_COMPRAS",
  ACOPIO: "ACOPIO",
  COMEX: "COMEX",
  APROBADOR: "APROBADOR",
  // Puede aprobar/rechazar cualquier Solped y participar en las firmas de
  // OC/OS sin restricción de área (p. ej. Gerente de Supply, District
  // Controller, Gerente General) — a diferencia de APROBADOR, que solo
  // aprueba lo de su propia área. No da los demás permisos de ADMIN
  // (gestión de usuarios, SKU, etc.).
  APROBADOR_GENERAL: "APROBADOR_GENERAL",
  // Único permiso que habilita anular Solpeds y OC/OS (en cualquier
  // estado) — ni ADMIN, ni APROBADOR_GENERAL, ni el aprobador de área lo
  // dan por sí solos; es exclusivo de quien tenga este rol.
  ANULADOR: "ANULADOR",
  SOLO_LECTURA: "SOLO_LECTURA",
  // Único rol habilitado para "cerrar posición" (Solped y OC/OS) y para
  // crear/editar Órdenes de compra y servicio (ver esComprador en
  // lib/compras.ts). Quien no lo tenga solo puede VER una OC/OS a la que
  // llegue (p. ej. por "Seguimiento del pedido" de su propia Solped).
  COMPRADORES: "COMPRADORES",
  // Quien atiende Solicitudes de Despacho (ver esAlmacen en
  // lib/stock-almacen.ts): solo quien tenga este rol (o ADMIN) ve la
  // bandeja completa y los controles para atenderlas. El resto solo ve
  // las solicitudes que generó, y nunca puede eliminar una.
  ALMACEN: "ALMACEN",
} as const;

export type RolNombre = (typeof ROLES)[keyof typeof ROLES];

export const ROL_LABELS: Record<RolNombre, string> = {
  ADMIN: "Administrador",
  LOGISTICA_COMPRAS: "Logística / Compras",
  ACOPIO: "Acopio",
  COMEX: "Comex",
  APROBADOR: "Aprobador",
  APROBADOR_GENERAL: "Aprobador general",
  ANULADOR: "Anulador exclusivo",
  SOLO_LECTURA: "Solo lectura",
  COMPRADORES: "Comprador",
  ALMACEN: "Almacén",
};

// Módulos del sistema, usados tanto por la navegación como por el control
// de acceso por rol. En esta fase el control es por módulo, no por campo.
export const MODULOS = {
  LOGISTICA: "logistica",
  ACOPIO: "acopio",
  USUARIOS: "usuarios",
  COMEX: "comex",
} as const;

export type Modulo = (typeof MODULOS)[keyof typeof MODULOS];

// Acceso por defecto de cada rol a cada módulo (lectura mínima garantizada).
// ADMIN y SOLO_LECTURA tienen reglas especiales resueltas en tienePermiso().
export const ACCESO_MODULO_POR_ROL: Record<RolNombre, Modulo[]> = {
  ADMIN: [MODULOS.LOGISTICA, MODULOS.ACOPIO, MODULOS.USUARIOS, MODULOS.COMEX],
  LOGISTICA_COMPRAS: [MODULOS.LOGISTICA],
  ACOPIO: [MODULOS.ACOPIO],
  COMEX: [MODULOS.COMEX],
  APROBADOR: [MODULOS.LOGISTICA, MODULOS.ACOPIO, MODULOS.COMEX],
  APROBADOR_GENERAL: [MODULOS.LOGISTICA, MODULOS.ACOPIO, MODULOS.COMEX],
  ANULADOR: [MODULOS.LOGISTICA, MODULOS.ACOPIO, MODULOS.COMEX],
  SOLO_LECTURA: [MODULOS.LOGISTICA, MODULOS.ACOPIO, MODULOS.USUARIOS, MODULOS.COMEX],
  // No otorga visibilidad de módulo por sí solo -- eso sigue dependiendo
  // de LOGISTICA_COMPRAS + la casilla de "Órdenes de compra" (ver
  // GRUPOS_ACCESO_ASIGNABLE). Es un permiso de ESCRITURA exclusivo dentro
  // de ese submódulo (ver esComprador en lib/compras.ts).
  COMPRADORES: [],
  // Ídem: no otorga visibilidad de módulo por sí solo (ese acceso sigue
  // viniendo de LOGISTICA_COMPRAS). Es el permiso de ESCRITURA exclusivo
  // para atender Solicitudes de Despacho — ver esAlmacen en
  // lib/stock-almacen.ts.
  ALMACEN: [],
};

export function tienePermiso(rolesUsuario: RolNombre[], modulo: Modulo): boolean {
  if (rolesUsuario.includes(ROLES.ADMIN)) return true;
  return rolesUsuario.some((rol) => ACCESO_MODULO_POR_ROL[rol]?.includes(modulo));
}
