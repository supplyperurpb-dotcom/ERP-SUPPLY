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
export type FilaDetallePdf = { hora: string; placa: string; modulo: string; variedad: string; kg: number };

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
  detalle,
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
  detalle: FilaDetallePdf[];
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

  page.drawText("Distribución de recepción", { x: MARGEN, y, size: 10, font: bold, color: NEGRO });
  y -= 18;
  page.drawText(`Aprovechable: ${kgAprovechable.toFixed(1)} kg  (${pctAprovechable.toFixed(1)}%)`, {
    x: colIzqX,
    y,
    size: 10,
    font: bold,
    color: VERDE,
  });
  page.drawText(`Nacional: ${kgNacionalCampo.toFixed(1)} kg  (${pctNacionalCampo.toFixed(1)}%)`, {
    x: colDerX,
    y,
    size: 10,
    font: bold,
    color: TURQUESA,
  });
  y -= 26;

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
    page.drawText(fila.modulo, { x: colModuloX + 4, y, size: 9, font: regular, color: NEGRO });
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
  page.drawLine({ start: { x: MARGEN, y: y + 10 }, end: { x: ANCHO - MARGEN, y: y + 10 }, thickness: 0.5, color: GRIS });
  page.drawText("TOTAL GENERAL", { x: colModuloX + 4, y, size: 9, font: bold, color: NEGRO });
  derecho(`${kgAprovechable.toFixed(1)} kg`, 9, colAprovDerX, bold, y, NEGRO);
  derecho(`${kgNacionalCampo.toFixed(1)} kg`, 9, colNacionalDerX, bold, y, NEGRO);
  derecho(`${kgRecepcionado.toFixed(1)} kg`, 9, colTotalDerX, bold, y, NEGRO);
  y -= 12;
  derecho(`${pctAprovechable.toFixed(1)}%`, 7.5, colAprovDerX, regular, y, VERDE);
  derecho(`${pctNacionalCampo.toFixed(1)}%`, 7.5, colNacionalDerX, regular, y, TURQUESA);
  y -= 28;

  // --- Tabla "Detalle de vehículos".
  const colHoraX = MARGEN;
  const colPlacaX = MARGEN + 60;
  const colModuloDetX = MARGEN + 150;
  const colVariedadDetX = MARGEN + 230;
  const colKgDerX = ANCHO - MARGEN;

  function encabezadoDetalle() {
    page.drawText("Detalle de vehículos", { x: MARGEN, y, size: 11, font: bold, color: NEGRO });
    y -= 18;
    page.drawRectangle({ x: MARGEN, y: y - 4, width: ANCHO - MARGEN * 2, height: 16, color: GRIS_CLARO });
    page.drawText("Hora", { x: colHoraX + 4, y, size: 8, font: bold, color: NEGRO });
    page.drawText("Placa", { x: colPlacaX + 4, y, size: 8, font: bold, color: NEGRO });
    page.drawText("Módulo", { x: colModuloDetX + 4, y, size: 8, font: bold, color: NEGRO });
    page.drawText("Variedad", { x: colVariedadDetX + 4, y, size: 8, font: bold, color: NEGRO });
    derecho("Kg", 8, colKgDerX, bold, y, NEGRO);
    y -= 18;
  }

  function filaDetalleCaberEn(alturaFila: number) {
    if (y - alturaFila < MARGEN + 40) {
      page = pdfDoc.addPage([ANCHO, ALTO]);
      y = ALTO - 50;
      encabezadoDetalle();
    }
  }

  encabezadoDetalle();
  let totalDetalleKg = 0;
  for (const f of detalle) {
    filaDetalleCaberEn(14);
    totalDetalleKg += f.kg;
    page.drawText(f.hora, { x: colHoraX + 4, y, size: 8.5, font: regular, color: NEGRO });
    page.drawText(f.placa, { x: colPlacaX + 4, y, size: 8.5, font: regular, color: NEGRO });
    page.drawText(f.modulo, { x: colModuloDetX + 4, y, size: 8.5, font: regular, color: NEGRO });
    page.drawText(f.variedad, { x: colVariedadDetX + 4, y, size: 8.5, font: regular, color: NEGRO });
    derecho(`${f.kg.toFixed(1)} kg`, 8.5, colKgDerX, regular, y, NEGRO);
    y -= 14;
  }

  filaDetalleCaberEn(20);
  page.drawLine({ start: { x: MARGEN, y: y + 10 }, end: { x: ANCHO - MARGEN, y: y + 10 }, thickness: 0.5, color: GRIS });
  page.drawText("TOTAL", { x: colHoraX + 4, y, size: 9, font: bold, color: NEGRO });
  derecho(`${totalDetalleKg.toFixed(1)} kg`, 9, colKgDerX, bold, y, NEGRO);

  const piePagina = `Generado el ${generadoEn}`;
  for (const pagina of pdfDoc.getPages() as PDFPage[]) {
    pagina.drawText(piePagina, { x: MARGEN, y: 24, size: 7, font: regular, color: GRIS });
  }

  return pdfDoc.save();
}
