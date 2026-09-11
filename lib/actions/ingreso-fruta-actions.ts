"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { ingresoFrutaSchema, type IngresoFrutaInput } from "@/lib/validations/ingreso-fruta";
import { CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET } from "@/lib/constants/pallet";

export type IngresoFrutaActionState = { error?: string; success?: boolean } | undefined;

type LineaCalculada = {
  numeroPallet: number;
  modulo: string;
  turno: string;
  variedad: string;
  tipoBandejaId: string;
  tipoPalletId: string | null;
  cantidadBandejas: number;
  pesoBrutoTotalKg: number;
  pesoTaraTotalKg: number;
  pesoNetoKg: number;
  palletAsignado: string;
};

export async function crearIngresoFrutaAction(data: IngresoFrutaInput): Promise<IngresoFrutaActionState> {
  const parsed = ingresoFrutaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const tiposBandeja = await prisma.tipoBandeja.findMany({
    where: { id: { in: parsed.data.pallets.map((p) => p.tipoBandejaId) } },
  });
  const taraPorTipoBandeja = new Map(tiposBandeja.map((t) => [t.id, Number(t.pesoTaraKg)]));

  const idsTipoPallet = parsed.data.pallets.map((p) => p.tipoPalletId).filter((id): id is string => !!id);
  const tiposPallet = idsTipoPallet.length
    ? await prisma.tipoPallet.findMany({ where: { id: { in: idsTipoPallet } } })
    : [];
  const taraPorTipoPallet = new Map(tiposPallet.map((t) => [t.id, Number(t.pesoTaraKg)]));

  for (const linea of parsed.data.pallets) {
    if (!taraPorTipoBandeja.has(linea.tipoBandejaId)) {
      return { error: "Uno de los tipos de bandeja seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
    }
    if (linea.tipoPalletId && !taraPorTipoPallet.has(linea.tipoPalletId)) {
      return { error: "Uno de los tipos de pallet seleccionados ya no existe. Actualiza la página e intenta de nuevo." };
    }
  }

  // Peso neto por línea = peso bruto - tara de las bandejas (cantidad ×
  // tara del catálogo) - tara del pallet/parihuela si se pesó con uno
  // (algunas líneas se pesan sin pallet físico debajo, de ahí que sea
  // opcional).
  const lineasCalculadas: LineaCalculada[] = parsed.data.pallets.map((linea, index) => {
    const taraBandejas = linea.cantidadBandejas * (taraPorTipoBandeja.get(linea.tipoBandejaId) ?? 0);
    const taraPallet = linea.tipoPalletId ? taraPorTipoPallet.get(linea.tipoPalletId) ?? 0 : 0;
    const pesoTaraTotalKg = taraBandejas + taraPallet;
    return {
      numeroPallet: index + 1,
      modulo: linea.modulo,
      turno: linea.turno,
      variedad: linea.variedad,
      tipoBandejaId: linea.tipoBandejaId,
      tipoPalletId: linea.tipoPalletId || null,
      cantidadBandejas: linea.cantidadBandejas,
      pesoBrutoTotalKg: linea.pesoBrutoTotalKg,
      pesoTaraTotalKg,
      pesoNetoKg: linea.pesoBrutoTotalKg - pesoTaraTotalKg,
      palletAsignado: linea.palletAsignado,
    };
  });

  // Agrupa las líneas por destino: pallets nuevos (identificados por un id
  // temporal generado en el cliente) y pallets físicos ya existentes.
  const gruposNuevo = new Map<string, LineaCalculada[]>();
  const gruposExistente = new Map<string, LineaCalculada[]>();

  for (const linea of lineasCalculadas) {
    const separador = linea.palletAsignado.indexOf(":");
    const tipo = separador === -1 ? "" : linea.palletAsignado.slice(0, separador);
    const id = separador === -1 ? "" : linea.palletAsignado.slice(separador + 1);

    if (tipo === "nuevo" && id) {
      const arr = gruposNuevo.get(id) ?? [];
      arr.push(linea);
      gruposNuevo.set(id, arr);
    } else if (tipo === "existente" && id) {
      const arr = gruposExistente.get(id) ?? [];
      arr.push(linea);
      gruposExistente.set(id, arr);
    } else {
      return { error: "Falta asignar una de las líneas a un pallet (nuevo o existente)." };
    }
  }

  for (const lineas of gruposNuevo.values()) {
    const total = lineas.reduce((acc, l) => acc + l.cantidadBandejas, 0);
    if (total > CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET) {
      return { error: `Un pallet nuevo no puede superar ${CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET} bandejas.` };
    }
  }

  const idsExistentes = Array.from(gruposExistente.keys());
  const palletsExistentes = idsExistentes.length
    ? await prisma.pallet.findMany({ where: { id: { in: idsExistentes } } })
    : [];
  const palletPorId = new Map(palletsExistentes.map((p) => [p.id, p]));

  for (const [palletId, lineas] of gruposExistente) {
    const pallet = palletPorId.get(palletId);
    if (!pallet || pallet.estado !== "ABIERTO") {
      return {
        error: "Uno de los pallets existentes seleccionados ya no está disponible. Actualiza la página e intenta de nuevo.",
      };
    }
    const totalNuevo = lineas.reduce((acc, l) => acc + l.cantidadBandejas, 0);
    if (pallet.cantidadBandejas + totalNuevo > CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET) {
      return {
        error: `El pallet ${pallet.numero} solo tiene espacio para ${
          CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET - pallet.cantidadBandejas
        } bandejas más.`,
      };
    }
  }

  const usuario = await getUsuarioActual();
  const totalIngresos = await prisma.ingresoFruta.count();
  const numero = `IF-${String(totalIngresos + 1).padStart(4, "0")}`;

  await prisma.$transaction(async (tx) => {
    const tempIdAPalletId = new Map<string, string>();
    let contador = await tx.pallet.count();

    for (const [tempId, lineas] of gruposNuevo) {
      contador += 1;
      const totalBandejas = lineas.reduce((acc, l) => acc + l.cantidadBandejas, 0);
      const totalBruto = lineas.reduce((acc, l) => acc + l.pesoBrutoTotalKg, 0);
      const totalTara = lineas.reduce((acc, l) => acc + l.pesoTaraTotalKg, 0);
      const totalNeto = lineas.reduce((acc, l) => acc + l.pesoNetoKg, 0);

      const nuevoPallet = await tx.pallet.create({
        data: {
          numero: `PAL-${String(contador).padStart(4, "0")}`,
          cantidadBandejas: totalBandejas,
          pesoBrutoTotalKg: totalBruto,
          pesoTaraTotalKg: totalTara,
          pesoNetoKg: totalNeto,
          estado: totalBandejas >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO",
          creadoPorId: usuario?.id,
        },
      });
      tempIdAPalletId.set(tempId, nuevoPallet.id);
    }

    for (const [palletId, lineas] of gruposExistente) {
      const pallet = palletPorId.get(palletId)!;
      const totalBandejas = lineas.reduce((acc, l) => acc + l.cantidadBandejas, 0);
      const totalBruto = lineas.reduce((acc, l) => acc + l.pesoBrutoTotalKg, 0);
      const totalTara = lineas.reduce((acc, l) => acc + l.pesoTaraTotalKg, 0);
      const totalNeto = lineas.reduce((acc, l) => acc + l.pesoNetoKg, 0);
      const nuevaCantidad = pallet.cantidadBandejas + totalBandejas;

      await tx.pallet.update({
        where: { id: palletId },
        data: {
          cantidadBandejas: { increment: totalBandejas },
          pesoBrutoTotalKg: { increment: totalBruto },
          pesoTaraTotalKg: { increment: totalTara },
          pesoNetoKg: { increment: totalNeto },
          estado: nuevaCantidad >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO",
        },
      });
    }

    await tx.ingresoFruta.create({
      data: {
        numero,
        proveedorId: parsed.data.proveedorId,
        lote: parsed.data.lote,
        fechaCosecha: parsed.data.fechaCosecha,
        horaIngreso: parsed.data.horaIngreso,
        placaTransporte: parsed.data.placaTransporte,
        observaciones: parsed.data.observaciones || null,
        creadoPorId: usuario?.id,
        pallets: {
          create: lineasCalculadas.map((linea) => {
            const separador = linea.palletAsignado.indexOf(":");
            const tipo = linea.palletAsignado.slice(0, separador);
            const id = linea.palletAsignado.slice(separador + 1);
            const palletId = tipo === "nuevo" ? tempIdAPalletId.get(id)! : id;

            return {
              numeroPallet: linea.numeroPallet,
              palletId,
              modulo: linea.modulo,
              turno: linea.turno,
              variedad: linea.variedad,
              tipoBandejaId: linea.tipoBandejaId,
              tipoPalletId: linea.tipoPalletId,
              cantidadBandejas: linea.cantidadBandejas,
              pesoBrutoTotalKg: linea.pesoBrutoTotalKg,
              pesoTaraTotalKg: linea.pesoTaraTotalKg,
              pesoNetoKg: linea.pesoNetoKg,
            };
          }),
        },
      },
    });
  });

  revalidatePath("/acopio/ingresos");
  redirect("/acopio/ingresos");
}
