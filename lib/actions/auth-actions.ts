"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/prisma";
import { loginSchema, cambiarPasswordPropiaSchema } from "@/lib/validations/auth";

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identificador: formData.get("identificador"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { identificador, password } = parsed.data;

  // Si no trae "@" es un DNI: se busca el correo real detrás (ver
  // Usuario.dni) para pasárselo a Supabase, que sigue siendo email+
  // password puertas adentro. Cuentas sin DNI asignado todavía (dni
  // nulo) siguen entrando con su correo tal cual, sin cambios.
  let email = identificador;
  if (!identificador.includes("@")) {
    const usuario = await prisma.usuario.findUnique({ where: { dni: identificador } });
    if (!usuario) {
      return { error: "DNI o contraseña incorrectos." };
    }
    email = usuario.email;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "DNI/correo o contraseña incorrectos." };
  }

  redirect("/inicio");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Cambio de contraseña obligatorio (primer ingreso o tras un reseteo de
// un admin) — la única vía de autoservicio que queda: no hay "olvidé mi
// contraseña" ni un "cambiar contraseña" de uso libre; solo un admin
// puede volver a pedírselo (ver editarUsuarioAction).
export async function cambiarPasswordPropiaAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = cambiarPasswordPropiaSchema.safeParse({
    nuevaPassword: formData.get("nuevaPassword"),
    confirmarPassword: formData.get("confirmarPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.nuevaPassword });
  if (error) {
    return { error: error.message };
  }

  await prisma.usuario.update({ where: { supabaseAuthId: user.id }, data: { debeCambiarPassword: false } });

  redirect("/inicio");
}
