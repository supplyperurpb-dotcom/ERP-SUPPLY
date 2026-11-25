"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import type { TipoPrecio, UnidadPrecio } from "@prisma/client";

// Gestión de Precios (Fase 5 del plan "COMEX: Base de datos centralizada de
// Exportaciones") — precios ingresados a mano, separados de lo histórico
// importado. Permite más de un precio por PO/producto a propósito (nunca
// se asume que un mismo producto tiene siempre el mismo precio).

export type NuevoPrecioInput = {
  po: string | null;
  embarqueId: string | null;
  productoSku: string | null;
  variedad: string | null;
  precioUnitario: number;
  moneda: string;
  unidad: UnidadPrecio;
  incoterm: string | null;
  tipoPrecio: TipoPrecio;
  vigenteDesde: Date | null;
  vigenteHasta: Date | null;
};

export async function crearPrecioAction(input: NuevoPrecioInput): Promise<{ error?: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión inválida." };
  if (!(input.precioUnitario > 0)) return { error: "El precio unitario debe ser mayor a 0." };
  if (!input.po && !input.embarqueId) return { error: "Falta el PO o el embarque." };

  try {
    await prisma.priceRecord.create({
      data: {
        po: input.po,
        embarqueId: input.embarqueId,
        productoSku: input.productoSku,
        variedad: input.variedad,
        precioUnitario: input.precioUnitario,
        moneda: input.moneda,
        unidad: input.unidad,
        incoterm: input.incoterm,
        tipoPrecio: input.tipoPrecio,
        vigenteDesde: input.vigenteDesde,
        vigenteHasta: input.vigenteHasta,
        creadoPorId: usuario.id,
      },
    });
    revalidatePath("/comex/gestion-precios");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el precio." };
  }
}

// Nunca se sobrescribe un precio sin dejar su valor anterior en
// PriceHistory (pedido explícito).
export async function actualizarPrecioAction(id: string, nuevoPrecio: number): Promise<{ error?: string }> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { error: "Sesión inválida." };
  if (!(nuevoPrecio > 0)) return { error: "El precio unitario debe ser mayor a 0." };

  try {
    const actual = await prisma.priceRecord.findUnique({ where: { id } });
    if (!actual) return { error: "No se encontró el precio." };

    await prisma.$transaction([
      prisma.priceHistory.create({
        data: {
          priceRecordId: id,
          precioAnterior: actual.precioUnitario,
          precioNuevo: nuevoPrecio,
          modificadoPorId: usuario.id,
        },
      }),
      prisma.priceRecord.update({ where: { id }, data: { precioUnitario: nuevoPrecio } }),
    ]);
    revalidatePath("/comex/gestion-precios");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo actualizar el precio." };
  }
}
