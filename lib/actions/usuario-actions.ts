"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { ROLES, ROL_LABELS, MODULOS, type Modulo, type RolNombre } from "@/lib/auth/constants";
import { NAV_GRUPOS } from "@/lib/nav-config";
import { crearUsuarioSchema, editarUsuarioSchema, type CrearUsuarioInput, type EditarUsuarioInput } from "@/lib/validations/usuarios";

// Rol de módulo (ver ACCESO_MODULO_POR_ROL) que corresponde a cada módulo
// del sidebar — "usuarios" queda fuera a propósito: ese acceso sigue
// siendo exclusivo de ADMIN, nunca se otorga por el árbol de casillas.
const ROL_POR_MODULO: Partial<Record<Modulo, keyof typeof ROLES>> = {
  [MODULOS.LOGISTICA]: "LOGISTICA_COMPRAS",
  [MODULOS.ACOPIO]: "ACOPIO",
  [MODULOS.COMEX]: "COMEX",
};

// Roles que este formulario (alta y edición) administra por completo: se
// reemplazan enteros en cada guardado. ADMIN, ANULADOR y SOLO_LECTURA quedan
// fuera a propósito — no se otorgan ni se revocan desde acá, así que
// editarUsuarioAction nunca les toca esos roles a quienes ya los tienen.
const ROLES_GESTIONADOS_POR_FORM: RolNombre[] = [
  ROLES.LOGISTICA_COMPRAS,
  ROLES.ACOPIO,
  ROLES.COMEX,
  ROLES.APROBADOR,
  ROLES.APROBADOR_GENERAL,
  ROLES.COMPRADORES,
  ROLES.ALMACEN,
];

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
  const { nombres, apellidos, email, dni, telefono, cargo, password, tipoRol, area, rolEspecial, accesoHrefs, esComprador, esAlmacen } =
    parsed.data;

  const quienCrea = await getUsuarioActual();
  if (!quienCrea || !quienCrea.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede crear usuarios." };
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return { error: "Ya existe un usuario con ese correo." };
  }

  const dniExistente = await prisma.usuario.findUnique({ where: { dni } });
  if (dniExistente) {
    return { error: "Ya existe un usuario con ese DNI." };
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
        dni,
        telefono: telefono || null,
        cargo: cargo || null,
        area,
        // Toda cuenta nueva debe elegir su propia contraseña en el primer
        // ingreso (ver /cambiar-password) — la que se generó/escribió acá
        // es solo para que pueda entrar esa primera vez.
        debeCambiarPassword: true,
      },
    });

    // Roles de módulo (ACOPIO/LOGISTICA_COMPRAS/COMEX) según qué hrefs se
    // marcaron en el árbol de casillas, más el rol de aprobador si
    // corresponde — son ejes independientes, un mismo usuario puede tener
    // varios roles de módulo a la vez (p. ej. Acopio + Comex).
    const nombresRolModulo = rolesDeModuloPorHrefs(accesoHrefs);
    const nombresRolAprobador: RolNombre[] =
      tipoRol === "APROBADOR" ? [ROLES.APROBADOR] : tipoRol === "APROBADOR_GENERAL" ? [ROLES.APROBADOR_GENERAL] : [];
    const nombresRolComprador: RolNombre[] = esComprador ? [ROLES.COMPRADORES] : [];
    const nombresRolAlmacen: RolNombre[] = esAlmacen ? [ROLES.ALMACEN] : [];
    const nombresRolAAsignar = Array.from(
      new Set([...nombresRolModulo, ...nombresRolAprobador, ...nombresRolComprador, ...nombresRolAlmacen])
    );

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

export type EditarUsuarioActionState = { error?: string; ok?: true } | undefined;

export async function editarUsuarioAction(
  usuarioId: string,
  data: EditarUsuarioInput
): Promise<EditarUsuarioActionState> {
  const parsed = editarUsuarioSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const {
    nombres,
    apellidos,
    email,
    dni,
    telefono,
    cargo,
    nuevaPassword,
    tipoRol,
    area,
    rolEspecial,
    accesoHrefs,
    activo,
    esComprador,
    esAlmacen,
  } = parsed.data;

  const quienEdita = await getUsuarioActual();
  if (!quienEdita || !quienEdita.roles.includes("ADMIN")) {
    return { error: "Solo un administrador puede editar usuarios." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    return { error: "El usuario no existe." };
  }

  if (usuario.id === quienEdita.id && !activo) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }

  if (email !== usuario.email) {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente && existente.id !== usuario.id) {
      return { error: "Ya existe un usuario con ese correo." };
    }
  }

  // dni vacío = "todavía sin asignar", se guarda como null (no como "" —
  // dos cuentas con dni="" chocarían contra el índice único).
  const dniNormalizado = dni || null;
  if (dniNormalizado && dniNormalizado !== usuario.dni) {
    const dniExistente = await prisma.usuario.findUnique({ where: { dni: dniNormalizado } });
    if (dniExistente && dniExistente.id !== usuario.id) {
      return { error: "Ya existe un usuario con ese DNI." };
    }
  }

  const admin = createSupabaseAdminClient();
  if (email !== usuario.email || nuevaPassword) {
    const { error: authError } = await admin.auth.admin.updateUserById(usuario.supabaseAuthId, {
      ...(email !== usuario.email ? { email, email_confirm: true } : {}),
      ...(nuevaPassword ? { password: nuevaPassword } : {}),
    });
    if (authError) {
      return { error: authError.message };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          nombres,
          apellidos,
          email,
          dni: dniNormalizado,
          telefono: telefono || null,
          cargo: cargo || null,
          area,
          activo,
          // Si se le asignó una contraseña nueva acá, debe volver a
          // elegir la suya propia en el próximo ingreso (/cambiar-password).
          ...(nuevaPassword ? { debeCambiarPassword: true } : {}),
        },
      });

      // Reemplaza solo los roles que este formulario administra (ver
      // ROLES_GESTIONADOS_POR_FORM) — ADMIN/ANULADOR/SOLO_LECTURA, si los
      // tenía, quedan intactos.
      await tx.asignacionRol.deleteMany({
        where: { usuarioId: usuario.id, rol: { nombre: { in: ROLES_GESTIONADOS_POR_FORM } } },
      });
      const nombresRolModulo = rolesDeModuloPorHrefs(accesoHrefs);
      const nombresRolAprobador: RolNombre[] =
        tipoRol === "APROBADOR" ? [ROLES.APROBADOR] : tipoRol === "APROBADOR_GENERAL" ? [ROLES.APROBADOR_GENERAL] : [];
      const nombresRolComprador: RolNombre[] = esComprador ? [ROLES.COMPRADORES] : [];
      const nombresRolAlmacen: RolNombre[] = esAlmacen ? [ROLES.ALMACEN] : [];
      const nombresRolAAsignar = Array.from(
        new Set([...nombresRolModulo, ...nombresRolAprobador, ...nombresRolComprador, ...nombresRolAlmacen])
      );
      if (nombresRolAAsignar.length > 0) {
        // Busca todos los Rol de una sola vez (reusando la conexión de la
        // transacción) en vez de un upsert por rol en una conexión aparte —
        // eso era lo que más alargaba la transacción en producción.
        const rolesExistentes = await tx.rol.findMany({ where: { nombre: { in: nombresRolAAsignar } } });
        const rolIdPorNombre = new Map(rolesExistentes.map((r) => [r.nombre, r.id]));
        for (const nombreRol of nombresRolAAsignar) {
          if (!rolIdPorNombre.has(nombreRol)) {
            const rol = await tx.rol.create({ data: { nombre: nombreRol, descripcion: ROL_LABELS[nombreRol] } });
            rolIdPorNombre.set(nombreRol, rol.id);
          }
        }
        await tx.asignacionRol.createMany({
          data: nombresRolAAsignar.map((nombreRol) => ({
            usuarioId: usuario.id,
            rolId: rolIdPorNombre.get(nombreRol)!,
            asignadoPorId: quienEdita.id,
          })),
        });
      }

      await tx.usuarioAccesoItem.deleteMany({ where: { usuarioId: usuario.id } });
      if (accesoHrefs.length > 0) {
        await tx.usuarioAccesoItem.createMany({
          data: accesoHrefs.map((href) => ({ usuarioId: usuario.id, href })),
        });
      }

      // El cupo de aprobador de área/rol especial es 1 usuario a la vez —
      // se limpia lo que tenía y se vuelve a asignar según el estado nuevo.
      await tx.aprobadorArea.deleteMany({ where: { usuarioId: usuario.id } });
      if (tipoRol === "APROBADOR") {
        await tx.aprobadorArea.upsert({
          where: { area },
          create: { area, usuarioId: usuario.id },
          update: { usuarioId: usuario.id },
        });
      }

      await tx.aprobadorEspecial.deleteMany({ where: { usuarioId: usuario.id } });
      if (tipoRol === "APROBADOR_GENERAL" && rolEspecial) {
        await tx.aprobadorEspecial.upsert({
          where: { rol: rolEspecial },
          create: { rol: rolEspecial, usuarioId: usuario.id },
          update: { usuarioId: usuario.id },
        });
      }
      // La transacción encadena varios round-trips (roles, acceso, aprobador
      // de área/especial) — el timeout default de Prisma (5s) se queda corto
      // bajo la latencia real de producción.
    }, { timeout: 15000 });

    revalidatePath("/usuarios/lista");
    revalidatePath("/usuarios/roles");
    revalidatePath(`/usuarios/${usuario.id}/editar`);
    return { ok: true };
  } catch (e) {
    console.error("Error inesperado en editarUsuarioAction:", e);
    return { error: e instanceof Error ? e.message : "Error inesperado al editar el usuario." };
  }
}
