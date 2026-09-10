"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { loginSchema, recuperarPasswordSchema } from "@/lib/validations/auth";

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Credenciales inválidas. Verifica tu correo y contraseña." };
  }

  redirect("/inicio");
}

export async function recuperarPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = recuperarPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  });

  // Se responde siempre igual (sin revelar si el correo existe o no).
  return { error: undefined };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
