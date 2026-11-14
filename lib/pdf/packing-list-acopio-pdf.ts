import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dibujarMarcaDeAgua } from "./marca-agua";

const ANCHO = 595.28; // A4 en puntos
const ALTO = 841.89;
const MARGEN = 40;

const AZUL = rgb(0.11, 0.29, 0.63);
const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.9, 0.9, 0.9);
const NEGRO = rgb(0.1, 0.1, 0.1);

export type LineaPackingListAcopio = {
  descripcion: string;
  pesoNetoKg: number;
};

export async function generarPackingListAcopioPdf({
  titulo = "PACKING LIST ACOPIO",
  numero,
  placaCamion,
  conductor,
  fechaDespacho,
  horaDespacho,
  numeroGuiaRemision,
  destino,
  registradoPor,
  lineas,
  totalBandejas,
  pesoNetoTotalKg,
  borrador,
}: {
  /** "PACKING LIST ACOPIO" (fruta exportable) o "PACKING LIST INDUSTRIAL ACOPIO" (Industrial/descarte). */
  titulo?: string;
  numero: string;
  placaCamion: string;
  conductor: string;
  fechaDespacho: Date;
  horaDespacho: string | null;
  numeroGuiaRemision: string | null;
  /** Solo el despacho de fruta exportable tiene un destino fijo (ver despacho-form.tsx). */
  destino?: string;
  /** Usuario que registró el despacho en el sistema (Despacho.creadoPorId). */
  registradoPor: string;
  lineas: LineaPackingListAcopio[];
  totalBandejas: number;
  pesoNetoTotalKg: number;
  /** El despacho todavía no "Culminó proceso": el PDF sale con marca de agua "BORRADOR". */
  borrador: boolean;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([ANCHO, ALTO]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = ALTO - 50;

  const centrado = (texto: string, tam: number, font = bold, color = AZUL) => {
    const ancho = font.widthOfTextAtSize(texto, tam);
    page.drawText(texto, { x: (ANCHO - ancho) / 2, y, size: tam, font, color });
  };

  centrado("REITER PERUVIAN BERRY SA", 10, regular, GRIS);
  y -= 14;
  centrado("Ica, Perú", 9, regular, GRIS);
  y -= 22;
  centrado(titulo, 18);
  y -= 24;
  centrado(numero, 16, bold, NEGRO);
  y -= 30;

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1, color: AZUL });
  y -= 24;

  const colIzqX = MARGEN;
  const colDerX = ANCHO / 2 + 10;
  const dato = (x: number, yPos: number, etiqueta: string, valor: string) => {
    page.drawText(etiqueta, { x, y: yPos, size: 8, font: regular, color: GRIS });
    page.drawText(valor, { x, y: yPos - 13, size: 11, font: bold, color: NEGRO });
  };

  dato(colIzqX, y, "Placa del camión", placaCamion || "—");
  dato(colDerX, y, "Conductor", conductor || "—");
  y -= 36;
  dato(colIzqX, y, "Fecha de despacho", `${fechaDespacho.toLocaleDateString("es-PE")}${horaDespacho ? ` ${horaDespacho}` : ""}`);
  dato(colDerX, y, "N.º de guía de remisión", numeroGuiaRemision || "— (pendiente)");
  y -= 36;

  if (destino) {
    dato(colIzqX, y, "Destino", destino);
    dato(colDerX, y, "Registrado por", registradoPor || "—");
    y -= 36;
  } else {
    dato(colIzqX, y, "Registrado por", registradoPor || "—");
    y -= 36;
  }

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.5, color: GRIS });
  y -= 20;

  const colDescripcion = MARGEN;
  const colUM = MARGEN + 400;
  const colCantidad = MARGEN + 450;

  function encabezadoTabla() {
    page.drawRectangle({ x: MARGEN, y: y - 4, width: ANCHO - MARGEN * 2, height: 18, color: GRIS_CLARO });
    page.drawText("Descripción", { x: colDescripcion + 4, y, size: 9, font: bold, color: NEGRO });
    page.drawText("UM", { x: colUM + 4, y, size: 9, font: bold, color: NEGRO });
    page.drawText("Cantidad", { x: colCantidad + 4, y, size: 9, font: bold, color: NEGRO });
    y -= 22;
  }

  encabezadoTabla();

  for (const linea of lineas) {
    if (y < MARGEN + 100) {
      page = pdfDoc.addPage([ANCHO, ALTO]);
      y = ALTO - 50;
      encabezadoTabla();
    }
    page.drawText(linea.descripcion, { x: colDescripcion + 4, y, size: 9, font: regular, color: NEGRO });
    page.drawText("KG", { x: colUM + 4, y, size: 9, font: regular, color: NEGRO });
    page.drawText(linea.pesoNetoKg.toFixed(2), { x: colCantidad + 4, y, size: 9, font: regular, color: NEGRO });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.5, color: GRIS });
  y -= 20;

  page.drawText("Total bandejas:", { x: MARGEN, y, size: 10, font: regular, color: GRIS });
  page.drawText(String(totalBandejas), { x: MARGEN + 110, y, size: 11, font: bold, color: NEGRO });
  y -= 18;
  page.drawText("Total kg:", { x: MARGEN, y, size: 10, font: regular, color: GRIS });
  page.drawText(`${pesoNetoTotalKg.toFixed(2)} kg`, { x: MARGEN + 110, y, size: 12, font: bold, color: AZUL });

  for (const pagina of pdfDoc.getPages()) {
    pagina.drawText("Documento interno — no válido como comprobante SUNAT.", {
      x: MARGEN,
      y: 24,
      size: 7,
      font: regular,
      color: GRIS,
    });
  }

  if (borrador) dibujarMarcaDeAgua(pdfDoc, bold, "BORRADOR");

  return pdfDoc.save();
}
