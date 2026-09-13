"use server";

import { revalidatePath } from "next/cache";
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
  formato: string;
  tipoProducto: string;
  tipoBandejaId: string;
  tipoPalletId: string | null;
  cantidadBandejas: number;
  pesoBrutoTotalKg: number;
  pesoTaraTotalKg: number;
  pesoNetoKg: number;
  palletAsignado: string;
};

// Error interno usado solo para abortar la transacción con un mensaje
// amigable (Prisma hace rollback automático si el callback lanza).
class ErrorValidacion extends Error {}

// Calcula tara/neto por línea y valida que los tipos de bandeja/pallet
// referenciados sigan existiendo. Compartido por crear y actualizar.
async function calcularLineas(pallets: IngresoFrutaInput["pallets"]): Promise<LineaCalculada[]> {
  const tiposBandeja = await prisma.tipoBandeja.findMany({
    where: { id: { in: pallets.map((p) => p.tipoBandejaId) } },
  });
  const taraPorTipoBandeja = new Map(tiposBandeja.map((t) => [t.id, Number(t.pesoTaraKg)]));

  const idsTipoPallet = pallets.map((p) => p.tipoPalletId).filter((id): id is string => !!id);
  const tiposPallet = idsTipoPallet.length
    ? await prisma.tipoPallet.findMany({ where: { id: { in: idsTipoPallet } } })
    : [];
  const taraPorTipoPallet = new Map(tiposPallet.map((t) => [t.id, Number(t.pesoTaraKg)]));

  for (const linea of pallets) {
    if (!taraPorTipoBandeja.has(linea.tipoBandejaId)) {
      throw new ErrorValidacion("Uno de los tipos de bandeja seleccionados ya no existe. Actualiza la página e intenta de nuevo.");
    }
    if (linea.tipoPalletId && !taraPorTipoPallet.has(linea.tipoPalletId)) {
      throw new ErrorValidacion("Uno de los tipos de pallet seleccionados ya no existe. Actualiza la página e intenta de nuevo.");
    }
  }

  // Peso neto por línea = peso bruto - tara de las bandejas (cantidad ×
  // tara del catálogo) - tara del pallet/parihuela si se pesó con uno
  // (algunas líneas se pesan sin pallet físico debajo, de ahí que sea
  // opcional).
  return pallets.map((linea, index) => {
    const taraBandejas = linea.cantidadBandejas * (taraPorTipoBandeja.get(linea.tipoBandejaId) ?? 0);
    const taraPallet = linea.tipoPalletId ? taraPorTipoPallet.get(linea.tipoPalletId) ?? 0 : 0;
    const pesoTaraTotalKg = taraBandejas + taraPallet;
    return {
      numeroPallet: index + 1,
      modulo: linea.modulo,
      turno: linea.turno,
      variedad: linea.variedad,
      formato: linea.formato,
      tipoProducto: linea.tipoProducto,
      tipoBandejaId: linea.tipoBandejaId,
      tipoPalletId: linea.tipoPalletId || null,
      cantidadBandejas: linea.cantidadBandejas,
      pesoBrutoTotalKg: linea.pesoBrutoTotalKg,
      pesoTaraTotalKg,
      pesoNetoKg: linea.pesoBrutoTotalKg - pesoTaraTotalKg,
      palletAsignado: linea.palletAsignado,
    };
  });
}

// Agrupa las líneas por destino: pallets nuevos (identificados por un id
// temporal generado en el cliente) y pallets físicos ya existentes.
function agruparPorDestino(lineasCalculadas: LineaCalculada[]) {
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
      throw new ErrorValidacion("Falta asignar una de las líneas a un pallet (nuevo o existente).");
    }
  }

  for (const lineas of gruposNuevo.values()) {
    const total = lineas.reduce((acc, l) => acc + l.cantidadBandejas, 0);
    if (total > CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET) {
      throw new ErrorValidacion(`Un pallet nuevo no puede superar ${CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET} bandejas.`);
    }
  }

  return { gruposNuevo, gruposExistente };
}

function sumar(lineas: LineaCalculada[]) {
  return {
    bandejas: lineas.reduce((acc, l) => acc + l.cantidadBandejas, 0),
    bruto: lineas.reduce((acc, l) => acc + l.pesoBrutoTotalKg, 0),
    tara: lineas.reduce((acc, l) => acc + l.pesoTaraTotalKg, 0),
    neto: lineas.reduce((acc, l) => acc + l.pesoNetoKg, 0),
  };
}

function datosLineaCrear(linea: LineaCalculada, palletId: string) {
  return {
    numeroPallet: linea.numeroPallet,
    palletId,
    modulo: linea.modulo,
    turno: linea.turno,
    variedad: linea.variedad,
    formato: linea.formato,
    tipoProducto: linea.tipoProducto,
    tipoBandejaId: linea.tipoBandejaId,
    tipoPalletId: linea.tipoPalletId,
    cantidadBandejas: linea.cantidadBandejas,
    pesoBrutoTotalKg: linea.pesoBrutoTotalKg,
    pesoTaraTotalKg: linea.pesoTaraTotalKg,
    pesoNetoKg: linea.pesoNetoKg,
  };
}

export async function crearIngresoFrutaAction(data: IngresoFrutaInput): Promise<IngresoFrutaActionState> {
  const parsed = ingresoFrutaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const lineasCalculadas = await calcularLineas(parsed.data.pallets);
    const { gruposNuevo, gruposExistente } = agruparPorDestino(lineasCalculadas);

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
      const { bandejas } = sumar(lineas);
      if (pallet.cantidadBandejas + bandejas > CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET) {
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
        const { bandejas, bruto, tara, neto } = sumar(lineas);
        const nuevoPallet = await tx.pallet.create({
          data: {
            numero: `PAL-${String(contador).padStart(4, "0")}`,
            cantidadBandejas: bandejas,
            pesoBrutoTotalKg: bruto,
            pesoTaraTotalKg: tara,
            pesoNetoKg: neto,
            estado: bandejas >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO",
            creadoPorId: usuario?.id,
          },
        });
        tempIdAPalletId.set(tempId, nuevoPallet.id);
      }

      for (const [palletId, lineas] of gruposExistente) {
        const pallet = palletPorId.get(palletId)!;
        const { bandejas, bruto, tara, neto } = sumar(lineas);
        const nuevaCantidad = pallet.cantidadBandejas + bandejas;
        await tx.pallet.update({
          where: { id: palletId },
          data: {
            cantidadBandejas: { increment: bandejas },
            pesoBrutoTotalKg: { increment: bruto },
            pesoTaraTotalKg: { increment: tara },
            pesoNetoKg: { increment: neto },
            estado: nuevaCantidad >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO",
          },
        });
      }

      await tx.ingresoFruta.create({
        data: {
          numero,
          proveedorId: parsed.data.proveedorId,
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
              return datosLineaCrear(linea, palletId);
            }),
          },
        },
      });
    });

    revalidatePath("/acopio/ingresos");
    return { success: true };
  } catch (e) {
    if (e instanceof ErrorValidacion) return { error: e.message };
    throw e;
  }
}

export async function actualizarIngresoFrutaAction(
  ingresoId: string,
  data: IngresoFrutaInput
): Promise<IngresoFrutaActionState> {
  const parsed = ingresoFrutaSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const ingresoExistente = await prisma.ingresoFruta.findUnique({
    where: { id: ingresoId },
    include: { pallets: true },
  });
  if (!ingresoExistente) {
    return { error: "El ingreso ya no existe. Actualiza la página e intenta de nuevo." };
  }

  try {
    const lineasCalculadas = await calcularLineas(parsed.data.pallets);
    const { gruposNuevo, gruposExistente } = agruparPorDestino(lineasCalculadas);
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      // 1. Revertir la contribución de las líneas ANTERIORES de este
      //    ingreso en sus pallets (para no arrastrar datos viejos).
      const pallePorIdRevertido = new Map<string, { cantidadBandejas: number }>();
      for (const lineaVieja of ingresoExistente.pallets) {
        const pallet = await tx.pallet.update({
          where: { id: lineaVieja.palletId },
          data: {
            cantidadBandejas: { decrement: lineaVieja.cantidadBandejas },
            pesoBrutoTotalKg: { decrement: lineaVieja.pesoBrutoTotalKg },
            pesoTaraTotalKg: { decrement: lineaVieja.pesoTaraTotalKg },
            pesoNetoKg: { decrement: lineaVieja.pesoNetoKg },
          },
        });
        const nuevaCantidad = Math.max(0, pallet.cantidadBandejas);
        await tx.pallet.update({
          where: { id: lineaVieja.palletId },
          data: { estado: nuevaCantidad >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO" },
        });
        pallePorIdRevertido.set(lineaVieja.palletId, { cantidadBandejas: nuevaCantidad });
      }

      // 2. Borrar las líneas anteriores.
      await tx.ingresoFrutaPallet.deleteMany({ where: { ingresoFrutaId: ingresoId } });

      // 3. Validar capacidad de los pallets existentes contra su estado YA
      //    revertido (si esta edición vuelve a usar el mismo pallet, su
      //    espacio liberado en el paso 1 ya está disponible aquí).
      const idsExistentes = Array.from(gruposExistente.keys());
      const palletsExistentesDb = idsExistentes.length
        ? await tx.pallet.findMany({ where: { id: { in: idsExistentes } } })
        : [];
      const palletPorId = new Map(palletsExistentesDb.map((p) => [p.id, p]));

      for (const [palletId, lineas] of gruposExistente) {
        const pallet = palletPorId.get(palletId);
        if (!pallet) {
          throw new ErrorValidacion(
            "Uno de los pallets existentes seleccionados ya no está disponible. Actualiza la página e intenta de nuevo."
          );
        }
        const { bandejas } = sumar(lineas);
        if (pallet.cantidadBandejas + bandejas > CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET) {
          throw new ErrorValidacion(
            `El pallet ${pallet.numero} solo tiene espacio para ${
              CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET - pallet.cantidadBandejas
            } bandejas más.`
          );
        }
      }

      // 4. Crear pallets nuevos e incrementar los existentes (igual que al
      //    crear un ingreso).
      const tempIdAPalletId = new Map<string, string>();
      let contador = await tx.pallet.count();

      for (const [tempId, lineas] of gruposNuevo) {
        contador += 1;
        const { bandejas, bruto, tara, neto } = sumar(lineas);
        const nuevoPallet = await tx.pallet.create({
          data: {
            numero: `PAL-${String(contador).padStart(4, "0")}`,
            cantidadBandejas: bandejas,
            pesoBrutoTotalKg: bruto,
            pesoTaraTotalKg: tara,
            pesoNetoKg: neto,
            estado: bandejas >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO",
            creadoPorId: usuario?.id,
          },
        });
        tempIdAPalletId.set(tempId, nuevoPallet.id);
      }

      for (const [palletId, lineas] of gruposExistente) {
        const pallet = palletPorId.get(palletId)!;
        const { bandejas, bruto, tara, neto } = sumar(lineas);
        const nuevaCantidad = pallet.cantidadBandejas + bandejas;
        await tx.pallet.update({
          where: { id: palletId },
          data: {
            cantidadBandejas: { increment: bandejas },
            pesoBrutoTotalKg: { increment: bruto },
            pesoTaraTotalKg: { increment: tara },
            pesoNetoKg: { increment: neto },
            estado: nuevaCantidad >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO",
          },
        });
      }

      // 5. Crear las líneas nuevas y actualizar la cabecera del ingreso.
      await tx.ingresoFruta.update({
        where: { id: ingresoId },
        data: {
          proveedorId: parsed.data.proveedorId,
          fechaCosecha: parsed.data.fechaCosecha,
          horaIngreso: parsed.data.horaIngreso,
          placaTransporte: parsed.data.placaTransporte,
          observaciones: parsed.data.observaciones || null,
          pallets: {
            create: lineasCalculadas.map((linea) => {
              const separador = linea.palletAsignado.indexOf(":");
              const tipo = linea.palletAsignado.slice(0, separador);
              const id = linea.palletAsignado.slice(separador + 1);
              const palletId = tipo === "nuevo" ? tempIdAPalletId.get(id)! : id;
              return datosLineaCrear(linea, palletId);
            }),
          },
        },
      });
    });

    revalidatePath("/acopio/ingresos");
    revalidatePath(`/acopio/ingresos/${ingresoId}`);
    revalidatePath("/acopio/tarjas");
    return { success: true };
  } catch (e) {
    if (e instanceof ErrorValidacion) return { error: e.message };
    throw e;
  }
}
