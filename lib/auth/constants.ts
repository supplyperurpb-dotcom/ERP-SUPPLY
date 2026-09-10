export const ROLES = {
  ADMIN: "ADMIN",
  LOGISTICA_COMPRAS: "LOGISTICA_COMPRAS",
  ACOPIO: "ACOPIO",
  COMEX: "COMEX",
  APROBADOR: "APROBADOR",
  SOLO_LECTURA: "SOLO_LECTURA",
} as const;

export type RolNombre = (typeof ROLES)[keyof typeof ROLES];

export const ROL_LABELS: Record<RolNombre, string> = {
  ADMIN: "Administrador",
  LOGISTICA_COMPRAS: "Logística / Compras",
  ACOPIO: "Acopio",
  COMEX: "Comex",
  APROBADOR: "Aprobador",
  SOLO_LECTURA: "Solo lectura",
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
  SOLO_LECTURA: [MODULOS.LOGISTICA, MODULOS.ACOPIO, MODULOS.USUARIOS, MODULOS.COMEX],
};

export function tienePermiso(rolesUsuario: RolNombre[], modulo: Modulo): boolean {
  if (rolesUsuario.includes(ROLES.ADMIN)) return true;
  return rolesUsuario.some((rol) => ACCESO_MODULO_POR_ROL[rol]?.includes(modulo));
}
