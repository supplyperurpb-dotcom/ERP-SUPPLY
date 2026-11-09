"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { ROLES, ROL_LABELS, MODULOS, type Modulo, type RolNombre } from "@/lib/auth/constants";
import { NAV_GRUPOS } from "@/lib/nav-config";
import { crearUsuarioSchema, type CrearUsuarioInput } from "@/lib/validations/usuarios";

// Rol de módulo (ver ACCESO_MODULO_POR_ROL) que corresponde a cada módulo
// del sidebar — "usuarios" queda fuera a propósito: ese acceso sigue
// siendo exclusivo de ADMIN, nunca se otorga por el árbol de casillas.
const ROL_POR_MODULO: Partial<Record<Modulo, keyof typeof ROLES>> = {
  [MODULOS.LOGISTICA]: "LOGISTICA_COMPRAS",
  [MODULOS.ACOPIO]: "ACOPIO",
  [MODULOS.COMEX]: "COMEX",
};

// A partir de los hrefs marcados en el árbol de casillas, calcula los
// módulos tocados (buscando en qué grupo de NAV_GRUPOS vive cada href) y
// de ahí qué roles de módulo hay que asignarle al usuario.
function rolesDeModuloPorHrefs(hrefs: string[]): RolNombre[] {
  const modulos = new Set<Modulo>();
  for (const href of hrefs) {
    const grupo = NAV_GRUPOS.find((g) => g.items.some((i) => i.href === href));
    if (grupo) modulos.add(grupo.modulo);
  }
  const nombres: RolNombre[] = [];
  for (const modulo of modulos) {
    const nombreRol = ROL_POR_MODULO[modulo];
    if (nombreRol) nombres.push(ROLES[nombreRol]);
  }
  return nombres;
}

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
  const { nombres, apellidos, email, telefono, cargo, password, tipoRol, area, rolEspecial, accesoHrefs } = parsed.data;

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
        cargo: cargo || null,
        area,
      },
    });

    // Roles de módulo (ACOPIO/LOGISTICA_COMPRAS/COMEX) según qué hrefs se
    // marcaron en el árbol de casillas, más el rol de aprobador si
    // corresponde — son ejes independientes, un mismo usuario puede tener
    // varios roles de módulo a la vez (p. ej. Acopio + Comex).
    const nombresRolModulo = rolesDeModuloPorHrefs(accesoHrefs);
    const nombresRolAprobador: RolNombre[] =
      tipoRol === "APROBADOR" ? [ROLES.APROBADOR] : tipoRol === "APROBADOR_GENERAL" ? [ROLES.APROBADOR_GENERAL] : [];
    const nombresRolAAsignar = Array.from(new Set([...nombresRolModulo, ...nombresRolAprobador]));

    for (const nombreRol of nombresRolAAsignar) {
      // Las claves de ROLES coinciden textualmente con sus valores
      // (ej. ROLES.ACOPIO === "ACOPIO"), así que nombreRol ya sirve como clave.
      const rol = await obtenerORol(nombreRol as keyof typeof ROLES);
      await prisma.asignacionRol.create({
        data: { usuarioId: nuevoUsuario.id, rolId: rol.id, asignadoPorId: quienCrea.id },
      });
    }

    if (accesoHrefs.length > 0) {
      await prisma.usuarioAccesoItem.createMany({
        data: accesoHrefs.map((href) => ({ usuarioId: nuevoUsuario.id, href })),
      });
    }

    if (tipoRol === "APROBADOR") {
      await prisma.aprobadorArea.upsert({
        where: { area },
        create: { area, usuarioId: nuevoUsuario.id },
        update: { usuarioId: nuevoUsuario.id },
      });
    }

    if (tipoRol === "APROBADOR_GENERAL" && rolEspecial) {
      await prisma.aprobadorEspecial.upsert({
        where: { rol: rolEspecial },
        create: { rol: rolEspecial, usuarioId: nuevoUsuario.id },
        update: { usuarioId: nuevoUsuario.id },
      });
    }

    revalidatePath("/usuarios/lista");
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
