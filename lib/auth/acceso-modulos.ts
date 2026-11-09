import { NAV_GRUPOS, type NavGrupo } from "@/lib/nav-config";
import { tienePermiso, ROLES, MODULOS, type Modulo, type RolNombre } from "@/lib/auth/constants";

// Grupos (y sus hrefs) seleccionables en el árbol de casillas de "Nuevo
// usuario" — se excluye "usuarios" a propósito: ese módulo sigue siendo
// exclusivo del rol ADMIN, nunca se otorga por esta vía.
export const GRUPOS_ACCESO_ASIGNABLE = NAV_GRUPOS.filter((g) => g.modulo !== MODULOS.USUARIOS);

/**
 * Grupos (y sus ítems) visibles para este usuario, para el sidebar y la
 * grilla de Inicio: primero filtra por rol como siempre
 * (ACCESO_MODULO_POR_ROL), y si además tiene un allowlist explícito de
 * hrefs (ver UsuarioAccesoItem), lo acota a exactamente esos ítems —
 * `accesoHrefs: null` (sin filas en BD, p. ej. todo usuario creado antes
 * de este modelo) conserva el acceso completo que ya daba el rol. ADMIN
 * nunca se restringe por esto.
 */
export function gruposVisiblesParaUsuario(roles: RolNombre[], accesoHrefs: string[] | null): NavGrupo[] {
  const esAdmin = roles.includes(ROLES.ADMIN);
  const setHrefs = accesoHrefs ? new Set(accesoHrefs) : null;

  return NAV_GRUPOS.filter((grupo) => tienePermiso(roles, grupo.modulo as Modulo))
    .map((grupo) => {
      if (esAdmin || !setHrefs) return grupo;
      return { ...grupo, items: grupo.items.filter((item) => setHrefs.has(item.href)) };
    })
    .filter((grupo) => grupo.items.length > 0);
}
