"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { proveedorSchema } from "@/lib/validations/proveedor";

export type ProveedorActionState = { error?: string; success?: boolean } | undefined;

// Crea la condición de pago en el catálogo (Logística > Listas) si todavía
// no existe con ese nombre (sin distinguir mayúsculas) — pedido explícito,
// 2026-11-27: se puede escribir una nueva acá mismo, al crear o editar un
// proveedor, sin pasar por esa pantalla.
async function aseguraCondicionPago(nombre: string): Promise<void> {
  const existente = await prisma.listaValor.findFirst({
    where: { tipo: "CONDICION_PAGO", nombre: { equals: nombre, mode: "insensitive" } },
  });
  if (existente) return;
  const ultimo = await prisma.listaValor.findFirst({ where: { tipo: "CONDICION_PAGO" }, orderBy: { orden: "desc" } });
  await prisma.listaValor.create({
    data: { tipo: "CONDICION_PAGO", nombre, orden: (ultimo?.orden ?? -1) + 1 },
  });
  revalidatePath("/logistica/listas/condiciones-pago");
}

export async function crearProveedorAction(
  _prevState: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  const parsed = proveedorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await aseguraCondicionPago(parsed.data.condicionPago);

  const usuario = await getUsuarioActual();

  const existente = await prisma.proveedor.findUnique({
    where: {
      tipoDocumento_numeroDocumento: {
        tipoDocumento: parsed.data.tipoDocumento,
        numeroDocumento: parsed.data.numeroDocumento,
      },
    },
  });
  if (existente) {
    return {
      error: `Ya existe un proveedor con ${parsed.data.tipoDocumento} ${parsed.data.numeroDocumento}`,
    };
  }

  await prisma.proveedor.create({
    data: { ...parsed.data, creadoPorId: usuario?.id },
  });

  revalidatePath("/logistica/proveedores");
  return { success: true };
}

export async function actualizarProveedorAction(
  id: string,
  _prevState: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  const parsed = proveedorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await aseguraCondicionPago(parsed.data.condicionPago);

  await prisma.proveedor.update({ where: { id }, data: parsed.data });

  revalidatePath("/logistica/proveedores");
  return { success: true };
}

export async function eliminarProveedorAction(id: string) {
  await prisma.proveedor.delete({ where: { id } });
  revalidatePath("/logistica/proveedores");
}
