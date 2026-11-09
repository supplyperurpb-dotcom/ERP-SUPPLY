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

// El href del ítem de NAV_GRUPOS que "contiene" esta ruta: el más
// específico cuyo href sea la ruta exacta o un prefijo de segmento de
// ella. Las subrutas (detalle, nuevo, editar) no tienen su propia entrada
// en NAV_GRUPOS, así que heredan el permiso de su ítem padre — p. ej.
// "/logistica/ordenes-compra" para "/logistica/ordenes-compra/123/editar".
function hrefContenedor(pathname: string): string | null {
  let mejor: string | null = null;
  for (const grupo of NAV_GRUPOS) {
    for (const item of grupo.items) {
      const coincide = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (coincide && (!mejor || item.href.length > mejor.length)) {
        mejor = item.href;
      }
    }
  }
  return mejor;
}

/**
 * Enforcement real (no solo visual) de a qué rutas del dashboard puede
 * entrar un usuario: una ruta queda permitida si no corresponde a ningún
 * ítem de NAV_GRUPOS (p. ej. /inicio, fuera de este sistema de
 * módulos/submódulos) o si ese ítem está entre los que
 * gruposVisiblesParaUsuario ya considera visibles para él. Pensado para
 * app/(dashboard)/layout.tsx — hasta ahora esto solo se aplicaba al
 * sidebar/Inicio, así que una URL directa a un módulo no marcado igual
 * funcionaba.
 */
export function rutaPermitida(roles: RolNombre[], accesoHrefs: string[] | null, pathname: string): boolean {
  const href = hrefContenedor(pathname);
  if (!href) return true;
  const hrefsVisibles = new Set(gruposVisiblesParaUsuario(roles, accesoHrefs).flatMap((g) => g.items.map((i) => i.href)));
  return hrefsVisibles.has(href);
}
