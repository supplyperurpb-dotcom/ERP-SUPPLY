"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { ingresoFrutaSchema, type IngresoFrutaInput } from "@/lib/validations/ingreso-fruta";

export type IngresoFrutaActionState = { error?: string; success?: boolean } | undefined;

export async function crearIngresoFrutaAction(data: IngresoFrutaInput): Promise<IngresoFrutaActionState> {
  const parsed = ingresoFrutaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const tiposBandeja = await prisma.tipoBandeja.findMany({
    where: { id: { in: parsed.data.pallets.map((p) => p.tipoBandejaId) } },
  });
  const taraPorTipo = new Map(tiposBandeja.map((t) => [t.id, Number(t.pesoTaraKg)]));

  for (const pallet of parsed.data.pallets) {
    if (!taraPorTipo.has(pallet.tipoBandejaId)) {
      return { error: "Uno de los tipos de bandeja seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
    }
  }

  // Peso neto = peso bruto - (cantidad de bandejas × peso tara de la bandeja
  // según el catálogo). No se descuenta tara de pallet: este flujo no la usa.
  const pallets = parsed.data.pallets.map((pallet, index) => {
    const pesoTaraTotalKg = pallet.cantidadBandejas * (taraPorTipo.get(pallet.tipoBandejaId) ?? 0);
    return {
      numeroPallet: index + 1,
      tipoBandejaId: pallet.tipoBandejaId,
      cantidadBandejas: pallet.cantidadBandejas,
      pesoBrutoTotalKg: pallet.pesoBrutoTotalKg,
      pesoTaraTotalKg,
      pesoNetoKg: pallet.pesoBrutoTotalKg - pesoTaraTotalKg,
    };
  });

  const usuario = await getUsuarioActual();
  const totalIngresos = await prisma.ingresoFruta.count();
  const numero = `IF-${String(totalIngresos + 1).padStart(4, "0")}`;

  await prisma.ingresoFruta.create({
    data: {
      numero,
      proveedorId: parsed.data.proveedorId,
      modulo: parsed.data.modulo,
      turno: parsed.data.turno,
      lote: parsed.data.lote,
      variedad: parsed.data.variedad,
      fechaCosecha: parsed.data.fechaCosecha,
      horaIngreso: parsed.data.horaIngreso,
      placaTransporte: parsed.data.placaTransporte || null,
      observaciones: parsed.data.observaciones || null,
      creadoPorId: usuario?.id,
      pallets: { create: pallets },
    },
  });

  revalidatePath("/acopio/ingresos");
  redirect("/acopio/ingresos");
}
