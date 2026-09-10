"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { proveedorSchema } from "@/lib/validations/proveedor";

export type ProveedorActionState = { error?: string; success?: boolean } | undefined;

export async function crearProveedorAction(
  _prevState: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  const parsed = proveedorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

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

  await prisma.proveedor.update({ where: { id }, data: parsed.data });

  revalidatePath("/logistica/proveedores");
  return { success: true };
}

export async function eliminarProveedorAction(id: string) {
  await prisma.proveedor.delete({ where: { id } });
  revalidatePath("/logistica/proveedores");
}
