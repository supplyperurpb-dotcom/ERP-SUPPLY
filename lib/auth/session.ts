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
  roles: RolNombre[];
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
    include: { asignacionesRol: { include: { rol: true } } },
  });

  if (!usuario) return null;

  return {
    id: usuario.id,
    supabaseAuthId: usuario.supabaseAuthId,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    area: usuario.area,
    roles: usuario.asignacionesRol.map((a) => a.rol.nombre as RolNombre),
  };
});
