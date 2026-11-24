import { NextResponse } from "next/server";
import { obtenerDatosReporteRecepcion, resolverFechaCosechaFiltro } from "@/lib/acopio-reporte";
import { generarReporteRecepcionPdf } from "@/lib/pdf/reporte-recepcion-pdf";

const TIPOS_OPERACION = ["Exportable", "Descarte Campo"] as const;

// Misma fuente de datos y mismos filtros que el dashboard
// (app/(dashboard)/acopio/reporte/page.tsx) — el botón "Generar Tarja PDF"
// abre esta ruta con la query string de los filtros actualmente aplicados
// en pantalla, así que ambas vistas siempre muestran los mismos números.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const semana = searchParams.get("semana") ?? undefined;
  const tipoParam = searchParams.get("tipo") ?? undefined;
  const campania = searchParams.get("campania") ?? undefined;
  const modulo = searchParams.get("modulo") ?? undefined;
  const variedad = searchParams.get("variedad") ?? undefined;

  const tipoOperacion = TIPOS_OPERACION.includes(tipoParam as (typeof TIPOS_OPERACION)[number])
    ? (tipoParam as (typeof TIPOS_OPERACION)[number])
    : null;

  const fechaCosecha = resolverFechaCosechaFiltro({ desde, hasta, semana, campania });
  const datos = await obtenerDatosReporteRecepcion({
    fechaCosecha,
    tipoOperacion,
    modulo: modulo ?? null,
    variedad: variedad ?? null,
  });

  const rangoFechasTexto = desde || hasta ? `${desde ?? "…"} – ${hasta ?? "…"}` : "Todas";
  const anioCampania = Number(campania);
  const campaniaTexto = campania && Number.isFinite(anioCampania) ? String(anioCampania) : "Todas";
  const generadoEn = new Date().toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const bytes = await generarReporteRecepcionPdf({
    generadoEn,
    rangoFechasTexto,
    campaniaTexto,
    moduloTexto: modulo ?? "Todos",
    variedadTexto: variedad ?? "Todas",
    cantidadIngresos: datos.cantidadIngresos,
    kgRecepcionado: datos.kgRecepcionado,
    kgAprovechable: datos.kgAprovechable,
    pctAprovechable: datos.pctAprovechable,
    kgNacionalCampo: datos.kgNacionalCampo,
    pctNacionalCampo: datos.pctNacionalCampo,
    resumen: datos.resumen,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="tarja-recepcion.pdf"',
    },
  });
}
