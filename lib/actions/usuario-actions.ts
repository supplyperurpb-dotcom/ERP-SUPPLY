"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { ROLES, ROL_LABELS } from "@/lib/auth/constants";
import { crearUsuarioSchema, type CrearUsuarioInput } from "@/lib/validations/usuarios";

export type CrearUsuarioActionState = { error?: string; id?: string } | undefined;

async function obtenerORol(nombre: keyof typeof ROLES) {
  return prisma.rol.upsert({
    where: { nombre: ROLES[nombre] },
    create: { nombre: ROLES[nombre], descripcion: ROL_LABELS[ROLES[nombre]] },
    update: {},
  });
}

export async function crearUsuarioAction(data: CrearUsuarioInput): Promise<CrearUsuarioActionState> {
  const parsed = crearUsuarioSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombres, apellidos, email, telefono, password, tipoRol, areaAprobador } = parsed.data;

  const quienCrea = await getUsuarioActual();
  if (!quienCrea || !quienCrea.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede crear usuarios." };
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return { error: "Ya existe un usuario con ese correo." };
  }

  const admin = createSupabaseAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return { error: authError?.message ?? "No se pudo crear la cuenta de acceso." };
  }

  try {
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        supabaseAuthId: authData.user.id,
        nombres,
        apellidos,
        email,
        telefono: telefono || null,
      },
    });

    const rol = await obtenerORol(tipoRol === "APROBADOR" ? "APROBADOR" : "LOGISTICA_COMPRAS");
    await prisma.asignacionRol.create({
      data: { usuarioId: nuevoUsuario.id, rolId: rol.id, asignadoPorId: quienCrea.id },
    });

    if (tipoRol === "APROBADOR" && areaAprobador) {
      await prisma.aprobadorArea.upsert({
        where: { area: areaAprobador },
        create: { area: areaAprobador, usuarioId: nuevoUsuario.id },
        update: { usuarioId: nuevoUsuario.id },
      });
    }

    revalidatePath("/usuarios");
    revalidatePath("/usuarios/roles");
    return { id: nuevoUsuario.id };
  } catch (e) {
    // Si algo falla después de crear la cuenta de acceso, se elimina para
    // no dejar una cuenta "fantasma" sin Usuario asociado.
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    console.error("Error inesperado en crearUsuarioAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al crear el usuario." };
  }
}
