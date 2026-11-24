import { prisma } from "@/lib/db/prisma";
import { rangoFechaCosecha, rangoSemanaISO } from "@/lib/utils";

export type FilaResumenRecepcion = { modulo: string; variedad: string; aprovechableKg: number; nacionalKg: number; total: number };

export type FilaDetalleRecepcion = {
  id: string;
  placa: string;
  hora: string;
  variedad: string;
  modulo: string;
  turno: string;
  kg: number;
  jabas: number;
};

export type FiltrosReporteRecepcion = {
  fechaCosecha?: { gte?: Date; lte?: Date };
  tipoOperacion?: "Exportable" | "Descarte Campo" | null;
  modulo?: string | null;
  variedad?: string | null;
};

export type DatosReporteRecepcion = {
  cantidadIngresos: number;
  kgAprovechable: number;
  jabasAprovechable: number;
  kgNacionalCampo: number;
  jabasNacionalCampo: number;
  kgRecepcionado: number;
  jabasRecepcionado: number;
  pctAprovechable: number;
  pctNacionalCampo: number;
  resumen: FilaResumenRecepcion[];
  detalle: FilaDetalleRecepcion[];
};

// Resuelve el rango de fechaCosecha a partir de los mismos 3 filtros que ya
// existían (desde/hasta, semana) más "campaña" (año de cosecha, derivado,
// no es un campo propio) — intersección de los 3, igual lógica que antes
// vivía inline en page.tsx. Compartido con la ruta de la Tarja PDF para que
// ambas vistas filtren exactamente igual.
export function resolverFechaCosechaFiltro({
  desde,
  hasta,
  semana,
  campania,
}: {
  desde?: string;
  hasta?: string;
  semana?: string;
  campania?: string;
}): { gte?: Date; lte?: Date } | undefined {
  let fechaCosecha = rangoFechaCosecha(desde, hasta);

  const [anioFiltro, semanaFiltro] = (semana ?? "").split("-").map(Number);
  if (semana && Number.isFinite(anioFiltro) && Number.isFinite(semanaFiltro)) {
    const rangoSemana = rangoSemanaISO(anioFiltro, semanaFiltro);
    fechaCosecha = {
      gte: fechaCosecha?.gte && fechaCosecha.gte > rangoSemana.gte ? fechaCosecha.gte : rangoSemana.gte,
      lte: fechaCosecha?.lte && fechaCosecha.lte < rangoSemana.lte ? fechaCosecha.lte : rangoSemana.lte,
    };
  }

  const anioCampania = Number(campania);
  if (campania && Number.isFinite(anioCampania)) {
    const rangoCampania = {
      gte: new Date(Date.UTC(anioCampania, 0, 1)),
      lte: new Date(Date.UTC(anioCampania, 11, 31, 23, 59, 59, 999)),
    };
    fechaCosecha = {
      gte: fechaCosecha?.gte && fechaCosecha.gte > rangoCampania.gte ? fechaCosecha.gte : rangoCampania.gte,
      lte: fechaCosecha?.lte && fechaCosecha.lte < rangoCampania.lte ? fechaCosecha.lte : rangoCampania.lte,
    };
  }

  return fechaCosecha;
}

// Misma lógica de datos/cálculo para Materia Prima (pestaña "Reporte
// diario"), usada tanto por el dashboard (app/(dashboard)/acopio/reporte/
// page.tsx) como por la Tarja PDF (app/api/pdf/reporte-recepcion/route.ts)
// — una sola fuente de verdad para que ambas vistas muestren siempre los
// mismos números. "Nacional Campo" acá es solo Descarte Campo (no se suma
// Industrial, que tiene su propio reporte/pestaña separado).
export async function obtenerDatosReporteRecepcion({
  fechaCosecha,
  tipoOperacion,
  modulo,
  variedad,
}: FiltrosReporteRecepcion): Promise<DatosReporteRecepcion> {
  const lineasFruta = await prisma.ingresoFrutaPallet.findMany({
    where: {
      ...(fechaCosecha ? { ingresoFruta: { fechaCosecha } } : {}),
      ...(tipoOperacion ? { tipoProducto: tipoOperacion } : {}),
      ...(modulo ? { modulo } : {}),
      ...(variedad ? { variedad } : {}),
    },
    select: {
      id: true,
      ingresoFrutaId: true,
      variedad: true,
      modulo: true,
      turno: true,
      tipoProducto: true,
      pesoNetoKg: true,
      cantidadBandejas: true,
      ingresoFruta: { select: { placaTransporte: true, horaIngreso: true } },
    },
  });

  const lineasAprovechable = lineasFruta.filter((l) => l.tipoProducto === "Exportable");
  const lineasNacionalCampo = lineasFruta.filter((l) => l.tipoProducto === "Descarte Campo");

  const kgAprovechable = lineasAprovechable.reduce((acc, l) => acc + Number(l.pesoNetoKg), 0);
  const jabasAprovechable = lineasAprovechable.reduce((acc, l) => acc + l.cantidadBandejas, 0);
  const kgNacionalCampo = lineasNacionalCampo.reduce((acc, l) => acc + Number(l.pesoNetoKg), 0);
  const jabasNacionalCampo = lineasNacionalCampo.reduce((acc, l) => acc + l.cantidadBandejas, 0);
  const kgRecepcionado = kgAprovechable + kgNacionalCampo;
  const jabasRecepcionado = jabasAprovechable + jabasNacionalCampo;
  const pctAprovechable = kgRecepcionado > 0 ? (kgAprovechable / kgRecepcionado) * 100 : 0;
  const pctNacionalCampo = kgRecepcionado > 0 ? (kgNacionalCampo / kgRecepcionado) * 100 : 0;

  const resumenPorModuloVariedad = new Map<string, FilaResumenRecepcion>();
  for (const l of lineasFruta) {
    const clave = `${l.modulo}__${l.variedad}`;
    const fila = resumenPorModuloVariedad.get(clave) ?? { modulo: l.modulo, variedad: l.variedad, aprovechableKg: 0, nacionalKg: 0, total: 0 };
    const kg = Number(l.pesoNetoKg);
    if (l.tipoProducto === "Exportable") fila.aprovechableKg += kg;
    else fila.nacionalKg += kg;
    fila.total += kg;
    resumenPorModuloVariedad.set(clave, fila);
  }
  const resumen = Array.from(resumenPorModuloVariedad.values()).sort(
    (a, b) => a.modulo.localeCompare(b.modulo) || a.variedad.localeCompare(b.variedad)
  );

  const detalle = lineasFruta
    .map((l) => ({
      id: l.id,
      placa: l.ingresoFruta.placaTransporte || "—",
      hora: l.ingresoFruta.horaIngreso || "—",
      variedad: l.variedad,
      modulo: l.modulo,
      turno: l.turno,
      kg: Number(l.pesoNetoKg),
      jabas: l.cantidadBandejas,
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const cantidadIngresos = new Set(lineasFruta.map((l) => l.ingresoFrutaId)).size;

  return {
    cantidadIngresos,
    kgAprovechable,
    jabasAprovechable,
    kgNacionalCampo,
    jabasNacionalCampo,
    kgRecepcionado,
    jabasRecepcionado,
    pctAprovechable,
    pctNacionalCampo,
    resumen,
    detalle,
  };
}
