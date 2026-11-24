import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

const ANCHO = 595.28; // A4 en puntos
const ALTO = 841.89;
const MARGEN = 40;

const AZUL = rgb(0.11, 0.29, 0.63);
const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.92, 0.92, 0.92);
const NEGRO = rgb(0.1, 0.1, 0.1);
// Mismos hex que COLOR_APROVECHABLE/COLOR_NACIONAL del dashboard
// (reporte-acopio-view.tsx): #397653 y #0D9488.
const VERDE = rgb(0x39 / 255, 0x76 / 255, 0x53 / 255);
const TURQUESA = rgb(0x0d / 255, 0x94 / 255, 0x88 / 255);

export type FilaResumenPdf = { modulo: string; variedad: string; aprovechableKg: number; nacionalKg: number; total: number };

export async function generarReporteRecepcionPdf({
  generadoEn,
  rangoFechasTexto,
  campaniaTexto,
  moduloTexto,
  variedadTexto,
  cantidadIngresos,
  kgRecepcionado,
  kgAprovechable,
  pctAprovechable,
  kgNacionalCampo,
  pctNacionalCampo,
  resumen,
}: {
  generadoEn: string;
  rangoFechasTexto: string;
  campaniaTexto: string;
  moduloTexto: string;
  variedadTexto: string;
  cantidadIngresos: number;
  kgRecepcionado: number;
  kgAprovechable: number;
  pctAprovechable: number;
  kgNacionalCampo: number;
  pctNacionalCampo: number;
  resumen: FilaResumenPdf[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([ANCHO, ALTO]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = ALTO - 50;

  const centrado = (texto: string, tam: number, font: PDFFont = bold, color = AZUL) => {
    const ancho = font.widthOfTextAtSize(texto, tam);
    page.drawText(texto, { x: (ANCHO - ancho) / 2, y, size: tam, font, color });
  };
  const derecho = (texto: string, tam: number, xDerecha: number, font: PDFFont, yPos: number, color = NEGRO) => {
    const ancho = font.widthOfTextAtSize(texto, tam);
    page.drawText(texto, { x: xDerecha - ancho, y: yPos, size: tam, font, color });
  };

  centrado("REITER PERUVIAN BERRY SA", 10, regular, GRIS);
  y -= 14;
  centrado("Ica, Perú", 9, regular, GRIS);
  y -= 22;
  centrado("TARJA DE RECEPCIÓN DE FRUTA", 16);
  y -= 30;

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1, color: AZUL });
  y -= 24;

  const colIzqX = MARGEN;
  const colDerX = ANCHO / 2 + 10;
  const dato = (x: number, yPos: number, etiqueta: string, valor: string) => {
    page.drawText(etiqueta, { x, y: yPos, size: 8, font: regular, color: GRIS });
    page.drawText(valor, { x, y: yPos - 13, size: 11, font: bold, color: NEGRO });
  };

  dato(colIzqX, y, "Fecha de cosecha", rangoFechasTexto);
  dato(colDerX, y, "Campaña", campaniaTexto);
  y -= 36;
  dato(colIzqX, y, "Módulo", moduloTexto);
  dato(colDerX, y, "Variedad", variedadTexto);
  y -= 36;
  dato(colIzqX, y, "N.º de ingresos", String(cantidadIngresos));
  dato(colDerX, y, "Total recibido", `${kgRecepcionado.toFixed(1)} kg`);
  y -= 34;

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.5, color: GRIS });
  y -= 20;

  page.drawText("DISTRIBUCIÓN DE RECEPCIÓN", { x: MARGEN, y, size: 9, font: bold, color: GRIS });
  y -= 18;

  // Barra proporcional Aprovechable/Nacional, igual que el dashboard: el
  // ancho de cada tramo es su % real, con el % escrito en blanco adentro
  // del tramo (si entra).
  const anchoBarra = ANCHO - MARGEN * 2;
  const altoBarra = 20;
  const hayDatosDistribucion = kgRecepcionado > 0;
  if (hayDatosDistribucion) {
    const anchoAprov = (pctAprovechable / 100) * anchoBarra;
    const anchoNacional = (pctNacionalCampo / 100) * anchoBarra;
    if (anchoAprov > 0) {
      page.drawRectangle({ x: MARGEN, y: y - altoBarra + 5, width: anchoAprov, height: altoBarra, color: VERDE });
      if (pctAprovechable >= 12) {
        const texto = `${pctAprovechable.toFixed(1)}%`;
        const anchoTexto = bold.widthOfTextAtSize(texto, 9);
        page.drawText(texto, { x: MARGEN + anchoAprov / 2 - anchoTexto / 2, y: y - altoBarra + 11, size: 9, font: bold, color: rgb(1, 1, 1) });
      }
    }
    if (anchoNacional > 0) {
      page.drawRectangle({ x: MARGEN + anchoAprov, y: y - altoBarra + 5, width: anchoNacional, height: altoBarra, color: TURQUESA });
      if (pctNacionalCampo >= 12) {
        const texto = `${pctNacionalCampo.toFixed(1)}%`;
        const anchoTexto = bold.widthOfTextAtSize(texto, 9);
        page.drawText(texto, {
          x: MARGEN + anchoAprov + anchoNacional / 2 - anchoTexto / 2,
          y: y - altoBarra + 11,
          size: 9,
          font: bold,
          color: rgb(1, 1, 1),
        });
      }
    }
  } else {
    page.drawRectangle({ x: MARGEN, y: y - altoBarra + 5, width: anchoBarra, height: altoBarra, color: GRIS_CLARO });
  }
  y -= altoBarra + 16;

  // Leyenda: cuadrito de color + label + kg + % — mismo patrón del dashboard.
  const cuadrito = (x: number, color = VERDE) => page.drawRectangle({ x, y: y - 7, width: 8, height: 8, color });
  cuadrito(colIzqX, VERDE);
  page.drawText("Aprovechable", { x: colIzqX + 12, y, size: 9, font: regular, color: GRIS });
  cuadrito(colDerX, TURQUESA);
  page.drawText("Nacional", { x: colDerX + 12, y, size: 9, font: regular, color: GRIS });
  y -= 15;
  page.drawText(`${kgAprovechable.toFixed(1)} kg  (${pctAprovechable.toFixed(1)}%)`, { x: colIzqX, y, size: 11, font: bold, color: VERDE });
  page.drawText(`${kgNacionalCampo.toFixed(1)} kg  (${pctNacionalCampo.toFixed(1)}%)`, { x: colDerX, y, size: 11, font: bold, color: TURQUESA });
  y -= 24;

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.5, color: GRIS });
  y -= 20;

  // --- Tabla "Resumen por módulo y variedad": celdas de 2 líneas
  // (kg + % de esa fila) para Aprov./Nacional, igual que el dashboard.
  const colModuloX = MARGEN;
  const colVariedadX = MARGEN + 60;
  const colAprovDerX = MARGEN + 300;
  const colNacionalDerX = MARGEN + 420;
  const colTotalDerX = ANCHO - MARGEN;

  function encabezadoResumen() {
    page.drawText("Resumen por módulo y variedad", { x: MARGEN, y, size: 11, font: bold, color: NEGRO });
    y -= 18;
    page.drawRectangle({ x: MARGEN, y: y - 4, width: ANCHO - MARGEN * 2, height: 16, color: GRIS_CLARO });
    page.drawText("Módulo", { x: colModuloX + 4, y, size: 8, font: bold, color: NEGRO });
    page.drawText("Variedad", { x: colVariedadX + 4, y, size: 8, font: bold, color: NEGRO });
    derecho("Aprov. (kg / %)", 8, colAprovDerX, bold, y, VERDE);
    derecho("Nacional (kg / %)", 8, colNacionalDerX, bold, y, TURQUESA);
    derecho("Total (kg)", 8, colTotalDerX, bold, y, NEGRO);
    y -= 20;
  }

  function filaCaberEn(alturaFila: number) {
    if (y - alturaFila < MARGEN + 60) {
      page = pdfDoc.addPage([ANCHO, ALTO]);
      y = ALTO - 50;
      encabezadoResumen();
    }
  }

  encabezadoResumen();
  for (const fila of resumen) {
    filaCaberEn(28);
    const pctAprov = fila.total > 0 ? (fila.aprovechableKg / fila.total) * 100 : 0;
    const pctNacional = fila.total > 0 ? (fila.nacionalKg / fila.total) * 100 : 0;
    // Badge de módulo (rectángulo azul marino + texto blanco), igual idea
    // que el badge del dashboard — pdf-lib no tiene esquinas redondeadas,
    // va recto.
    const anchoBadge = bold.widthOfTextAtSize(fila.modulo, 8) + 10;
    page.drawRectangle({ x: colModuloX + 2, y: y - 3, width: anchoBadge, height: 14, color: AZUL });
    page.drawText(fila.modulo, { x: colModuloX + 7, y, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText(fila.variedad, { x: colVariedadX + 4, y, size: 9, font: regular, color: NEGRO });
    derecho(`${fila.aprovechableKg.toFixed(1)} kg`, 9, colAprovDerX, bold, y, NEGRO);
    derecho(`${fila.nacionalKg.toFixed(1)} kg`, 9, colNacionalDerX, bold, y, NEGRO);
    derecho(`${fila.total.toFixed(1)} kg`, 9, colTotalDerX, bold, y, NEGRO);
    y -= 12;
    derecho(`${pctAprov.toFixed(1)}%`, 7.5, colAprovDerX, regular, y, VERDE);
    derecho(`${pctNacional.toFixed(1)}%`, 7.5, colNacionalDerX, regular, y, TURQUESA);
    y -= 16;
  }

  filaCaberEn(28);
  const VERDE_CLARO = rgb(0.91, 0.96, 0.93); // mismo tono que bg-emerald-50 del dashboard
  page.drawRectangle({ x: MARGEN, y: y - 16, width: ANCHO - MARGEN * 2, height: 30, color: VERDE_CLARO });
  page.drawText("TOTAL GENERAL", { x: colModuloX + 4, y, size: 9, font: bold, color: NEGRO });
  derecho(`${kgAprovechable.toFixed(1)} kg`, 9, colAprovDerX, bold, y, NEGRO);
  derecho(`${kgNacionalCampo.toFixed(1)} kg`, 9, colNacionalDerX, bold, y, NEGRO);
  derecho(`${kgRecepcionado.toFixed(1)} kg`, 9, colTotalDerX, bold, y, NEGRO);
  y -= 12;
  derecho(`${pctAprovechable.toFixed(1)}%`, 7.5, colAprovDerX, regular, y, VERDE);
  derecho(`${pctNacionalCampo.toFixed(1)}%`, 7.5, colNacionalDerX, regular, y, TURQUESA);

  const piePagina = `Generado el ${generadoEn}`;
  for (const pagina of pdfDoc.getPages() as PDFPage[]) {
    pagina.drawText(piePagina, { x: MARGEN, y: 24, size: 7, font: regular, color: GRIS });
  }

  return pdfDoc.save();
}
