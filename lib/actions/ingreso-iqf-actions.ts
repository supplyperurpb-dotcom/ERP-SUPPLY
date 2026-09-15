"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { ingresoIQFSchema, type IngresoIQFInput } from "@/lib/validations/ingreso-iqf";
import { TIPO_PRODUCTO_DESCARTE_PLANTA } from "@/lib/constants/iqf";
import { CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET } from "@/lib/constants/pallet";
import { maximoNumero, siguienteNumero } from "@/lib/utils";

export type IngresoIQFActionState = { error?: string; success?: boolean; id?: string } | undefined;

type LineaCalculada = {
  numeroPallet: number;
  variedad: string;
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

// Regla de negocio: un pallet IQF nunca mezcla bandejas de distinto tipo
// (p. ej. bandejas y jabas). Se valida entre las líneas nuevas que apuntan
// al mismo destino y contra el tipo de bandeja que ese pallet ya tenga.
function validarBandejaUniformeEnGrupo(lineas: LineaCalculada[]) {
  const tipos = new Set(lineas.map((l) => l.tipoBandejaId));
  if (tipos.size > 1) {
    throw new ErrorValidacion(
      "No se puede mezclar distintos tipos de bandeja (p. ej. bandejas y jabas) en un mismo pallet. Usa un pallet separado para cada tipo de bandeja."
    );
  }
}

async function validarBandejaContraExistente(
  lineas: LineaCalculada[],
  palletNumero: string,
  lineaExistente: { tipoBandejaId: string } | null
) {
  validarBandejaUniformeEnGrupo(lineas);
  if (lineaExistente && lineaExistente.tipoBandejaId !== lineas[0].tipoBandejaId) {
    throw new ErrorValidacion(
      `No se puede asignar esta línea al pallet ${palletNumero}: ya tiene un tipo de bandeja distinto. No se pueden mezclar tipos de bandeja en un mismo pallet.`
    );
  }
}

// Regla de negocio pedida por el usuario: el descarte de planta de una
// variedad solo se puede registrar en una fecha de cosecha en la que esa
// variedad SÍ llegó como materia prima (Ingreso de Materia Prima). Evita
// registrar por error un descarte de una variedad que ese día no se cosechó.
async function validarVariedadesContraMateriaPrima(fechaCosecha: Date, variedades: string[]) {
  const variedadesUnicas = Array.from(new Set(variedades));
  const registros = await prisma.ingresoFrutaPallet.findMany({
    where: {
      variedad: { in: variedadesUnicas },
      ingresoFruta: { fechaCosecha },
    },
    select: { variedad: true },
  });
  const variedadesConRegistro = new Set(registros.map((r) => r.variedad));

  for (const variedad of variedadesUnicas) {
    if (!variedadesConRegistro.has(variedad)) {
      throw new ErrorValidacion(
        `No se tuvo registro de la variedad "${variedad}" en la fecha de cosecha ingresada. Verifica la fecha o la variedad.`
      );
    }
  }
}

// Calcula tara/neto por línea y valida que los tipos de bandeja/pallet
// referenciados sigan existiendo. Compartido por crear y actualizar.
async function calcularLineas(
  fechaCosecha: Date,
  pallets: IngresoIQFInput["pallets"]
): Promise<LineaCalculada[]> {
  await validarVariedadesContraMateriaPrima(
    fechaCosecha,
    pallets.map((p) => p.variedad)
  );

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

  return pallets.map((linea, index) => {
    const taraBandejas = linea.cantidadBandejas * (taraPorTipoBandeja.get(linea.tipoBandejaId) ?? 0);
    const taraPallet = linea.tipoPalletId ? taraPorTipoPallet.get(linea.tipoPalletId) ?? 0 : 0;
    const pesoTaraTotalKg = taraBandejas + taraPallet;
    return {
      numeroPallet: index + 1,
      variedad: linea.variedad,
      tipoProducto: TIPO_PRODUCTO_DESCARTE_PLANTA,
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
    validarBandejaUniformeEnGrupo(lineas);
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
    variedad: linea.variedad,
    tipoProducto: linea.tipoProducto,
    tipoBandejaId: linea.tipoBandejaId,
    tipoPalletId: linea.tipoPalletId,
    cantidadBandejas: linea.cantidadBandejas,
    pesoBrutoTotalKg: linea.pesoBrutoTotalKg,
    pesoTaraTotalKg: linea.pesoTaraTotalKg,
    pesoNetoKg: linea.pesoNetoKg,
  };
}

export async function crearIngresoIQFAction(data: IngresoIQFInput): Promise<IngresoIQFActionState> {
  const parsed = ingresoIQFSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const lineasCalculadas = await calcularLineas(parsed.data.fechaCosecha, parsed.data.pallets);
    const { gruposNuevo, gruposExistente } = agruparPorDestino(lineasCalculadas);

    const idsExistentes = Array.from(gruposExistente.keys());
    const palletsExistentes = idsExistentes.length
      ? await prisma.palletIQF.findMany({ where: { id: { in: idsExistentes } } })
      : [];
    const palletPorId = new Map(palletsExistentes.map((p) => [p.id, p]));

    for (const [palletId, lineas] of gruposExistente) {
      const pallet = palletPorId.get(palletId);
      if (!pallet || pallet.estado !== "ABIERTO" || pallet.origen !== "DESCARTE_PLANTA") {
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
      const lineaExistente = await prisma.ingresoIQFPallet.findFirst({
        where: { palletId },
        select: { tipoBandejaId: true },
      });
      await validarBandejaContraExistente(lineas, pallet.numero, lineaExistente);
    }

    const usuario = await getUsuarioActual();
    const ingresosExistentes = await prisma.ingresoIQF.findMany({ select: { numero: true } });
    const numero = siguienteNumero(ingresosExistentes.map((i) => i.numero), "IQF-");

    const nuevoIngreso = await prisma.$transaction(async (tx) => {
      const tempIdAPalletId = new Map<string, string>();
      const palletsIQFExistentesNumeros = await tx.palletIQF.findMany({ select: { numero: true } });
      let contador = maximoNumero(palletsIQFExistentesNumeros.map((p) => p.numero), "PIQF-");

      for (const [tempId, lineas] of gruposNuevo) {
        contador += 1;
        const { bandejas, bruto, tara, neto } = sumar(lineas);
        const nuevoPallet = await tx.palletIQF.create({
          data: {
            numero: `PIQF-${String(contador).padStart(4, "0")}`,
            origen: "DESCARTE_PLANTA",
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
        await tx.palletIQF.update({
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

      return tx.ingresoIQF.create({
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

    revalidatePath("/acopio/ingreso-iqf");
    return { success: true, id: nuevoIngreso.id };
  } catch (e) {
    if (e instanceof ErrorValidacion) return { error: e.message };
    console.error("Error inesperado en ingreso IQF:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el ingreso." };
  }
}

export async function actualizarIngresoIQFAction(
  ingresoId: string,
  data: IngresoIQFInput
): Promise<IngresoIQFActionState> {
  const parsed = ingresoIQFSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const ingresoExistente = await prisma.ingresoIQF.findUnique({
    where: { id: ingresoId },
    include: { pallets: true },
  });
  if (!ingresoExistente) {
    return { error: "El ingreso ya no existe. Actualiza la página e intenta de nuevo." };
  }

  try {
    const lineasCalculadas = await calcularLineas(parsed.data.fechaCosecha, parsed.data.pallets);
    const { gruposNuevo, gruposExistente } = agruparPorDestino(lineasCalculadas);
    const usuario = await getUsuarioActual();

    await prisma.$transaction(async (tx) => {
      // 1. Revertir la contribución de las líneas ANTERIORES de este
      //    ingreso en sus pallets (para no arrastrar datos viejos).
      for (const lineaVieja of ingresoExistente.pallets) {
        const pallet = await tx.palletIQF.update({
          where: { id: lineaVieja.palletId },
          data: {
            cantidadBandejas: { decrement: lineaVieja.cantidadBandejas },
            pesoBrutoTotalKg: { decrement: lineaVieja.pesoBrutoTotalKg },
            pesoTaraTotalKg: { decrement: lineaVieja.pesoTaraTotalKg },
            pesoNetoKg: { decrement: lineaVieja.pesoNetoKg },
          },
        });
        const nuevaCantidad = Math.max(0, pallet.cantidadBandejas);
        await tx.palletIQF.update({
          where: { id: lineaVieja.palletId },
          data: { estado: nuevaCantidad >= CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET ? "CERRADO" : "ABIERTO" },
        });
      }

      // 2. Borrar las líneas anteriores.
      await tx.ingresoIQFPallet.deleteMany({ where: { ingresoIQFId: ingresoId } });

      // 3. Validar capacidad de los pallets existentes contra su estado YA
      //    revertido (si esta edición vuelve a usar el mismo pallet, su
      //    espacio liberado en el paso 1 ya está disponible aquí).
      const idsExistentes = Array.from(gruposExistente.keys());
      const palletsExistentesDb = idsExistentes.length
        ? await tx.palletIQF.findMany({ where: { id: { in: idsExistentes } } })
        : [];
      const palletPorId = new Map(palletsExistentesDb.map((p) => [p.id, p]));

      for (const [palletId, lineas] of gruposExistente) {
        const pallet = palletPorId.get(palletId);
        if (!pallet || pallet.origen !== "DESCARTE_PLANTA") {
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
        const lineaExistente = await tx.ingresoIQFPallet.findFirst({
          where: { palletId },
          select: { tipoBandejaId: true },
        });
        await validarBandejaContraExistente(lineas, pallet.numero, lineaExistente);
      }

      // 4. Crear pallets nuevos e incrementar los existentes (igual que al
      //    crear un ingreso).
      const tempIdAPalletId = new Map<string, string>();
      const palletsIQFExistentesNumeros = await tx.palletIQF.findMany({ select: { numero: true } });
      let contador = maximoNumero(palletsIQFExistentesNumeros.map((p) => p.numero), "PIQF-");

      for (const [tempId, lineas] of gruposNuevo) {
        contador += 1;
        const { bandejas, bruto, tara, neto } = sumar(lineas);
        const nuevoPallet = await tx.palletIQF.create({
          data: {
            numero: `PIQF-${String(contador).padStart(4, "0")}`,
            origen: "DESCARTE_PLANTA",
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
        await tx.palletIQF.update({
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
      await tx.ingresoIQF.update({
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

    revalidatePath("/acopio/ingreso-iqf");
    revalidatePath(`/acopio/ingreso-iqf/${ingresoId}`);
    revalidatePath("/acopio/tarjas-iqf");
    return { success: true };
  } catch (e) {
    if (e instanceof ErrorValidacion) return { error: e.message };
    console.error("Error inesperado en ingreso IQF:", e);
    return { error: e instanceof Error ? `Error inesperado: ${e.message}` : "Error inesperado al guardar el ingreso." };
  }
}
