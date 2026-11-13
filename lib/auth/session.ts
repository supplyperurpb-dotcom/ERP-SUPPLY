import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import type { RolNombre } from "@/lib/auth/constants";

export type UsuarioActual = {
  id: string;
  supabaseAuthId: string;
  nombres: string;
  apellidos: string;
  email: string;
  // Área del usuario (null = sin restricción, p. ej. ADMIN o cuentas
  // creadas antes de este campo). Acota qué Solicitudes de pedido y
  // Órdenes de compra/servicio puede ver, sea o no aprobador.
  area: string | null;
  // Área puntual (nivel 2) dentro de esa Gerencia — mismo organigrama que
  // Solped (ver AREAS_SOLPED en lib/constants/compras.ts). Null donde la
  // Gerencia no se subdivide, o en cuentas de antes de este campo. Ver
  // esAlmacen en lib/stock-almacen.ts.
  areaDetalle: string | null;
  roles: RolNombre[];
  // Allowlist de hrefs del sidebar (ver UsuarioAccesoItem). null = el
  // usuario no tiene ninguna fila configurada, así que no está acotado por
  // esto — conserva el acceso normal por rol (todos los usuarios creados
  // antes de este campo). Ver gruposVisiblesParaUsuario en
  // lib/auth/acceso-modulos.ts.
  accesoHrefs: string[] | null;
  // DNI con el que inicia sesión — null en cuentas creadas antes de este
  // campo, hasta que un admin se lo asigne.
  dni: string | null;
  // true = debe pasar por /cambiar-password antes de usar el resto de la
  // app (ver app/(dashboard)/layout.tsx).
  debeCambiarPassword: boolean;
};

// cache() evita duplicar la consulta a Supabase/Prisma cuando varios
// Server Components de la misma request necesitan el usuario actual.
export const getUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { supabaseAuthId: user.id },
    include: { asignacionesRol: { include: { rol: true } }, accesoItems: { select: { href: true } } },
  });

  // Un usuario desactivado conserva su cuenta en Supabase Auth pero deja de
  // poder usar la app — se trata como "no logueado" en todo el dashboard.
  if (!usuario || !usuario.activo) return null;

  return {
    id: usuario.id,
    supabaseAuthId: usuario.supabaseAuthId,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    area: usuario.area,
    areaDetalle: usuario.areaDetalle,
    roles: usuario.asignacionesRol.map((a) => a.rol.nombre as RolNombre),
    accesoHrefs: usuario.accesoItems.length > 0 ? usuario.accesoItems.map((a) => a.href) : null,
    dni: usuario.dni,
    debeCambiarPassword: usuario.debeCambiarPassword,
  };
});
