import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// 1 cm = 28.3465 pt. Etiqueta de 10 x 15 cm (para imprimir y pegar en el pallet).
const CM = 28.3465;
const ANCHO = 10 * CM;
const ALTO = 15 * CM;

const AZUL = rgb(0.11, 0.29, 0.63);
const GRIS = rgb(0.4, 0.4, 0.4);
const NEGRO = rgb(0.1, 0.1, 0.1);

export type LineaTarjaIQF = {
  variedad: string;
  tipoBandeja: string;
  cantidadBandejas: number;
  pesoNetoKg: number;
};

export async function generarTarjaIQFPdf({
  tarjaNumero,
  palletNumero,
  fechaEmision,
  proveedor,
  tipoProducto,
  lineas,
  totalBandejas,
  pesoBrutoTotalKg,
  pesoTaraTotalKg,
  pesoNetoTotalKg,
}: {
  tarjaNumero: string;
  palletNumero: string;
  fechaEmision: Date;
  proveedor: string;
  /** "Descarte Campo" o "Descarte Planta", según el origen del pallet. */
  tipoProducto: string;
  lineas: LineaTarjaIQF[];
  totalBandejas: number;
  pesoBrutoTotalKg: number;
  pesoTaraTotalKg: number;
  pesoNetoTotalKg: number;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([ANCHO, ALTO]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margen = 14;
  let y = ALTO - 20;

  const centrado = (texto: string, tam: number, font = bold) => {
    const ancho = font.widthOfTextAtSize(texto, tam);
    page.drawText(texto, { x: (ANCHO - ancho) / 2, y, size: tam, font, color: AZUL });
  };

  centrado("REITER PERUVIAN BERRY SA", 7, regular);
  y -= 10;
  centrado("Ica, Perú", 6, regular);
  y -= 14;
  page.drawLine({ start: { x: margen, y }, end: { x: ANCHO - margen, y }, thickness: 1, color: AZUL });
  y -= 20;

  centrado("TARJA DE PALLET — IQF", 12);
  y -= 20;
  centrado(tarjaNumero, 20);
  y -= 26;

  page.drawText(`Pallet: ${palletNumero}`, { x: margen, y, size: 9, font: bold, color: NEGRO });
  y -= 13;
  page.drawText(`Fecha: ${fechaEmision.toLocaleDateString("es-PE")}`, {
    x: margen,
    y,
    size: 8,
    font: regular,
    color: GRIS,
  });
  y -= 12;
  page.drawText(`Proveedor / Fundo: ${proveedor}`, { x: margen, y, size: 8, font: regular, color: GRIS });
  y -= 12;
  page.drawText(`Tipo de producto: ${tipoProducto}`, { x: margen, y, size: 8, font: regular, color: GRIS });
  y -= 16;

  page.drawLine({ start: { x: margen, y }, end: { x: ANCHO - margen, y }, thickness: 0.5, color: GRIS });
  y -= 14;

  page.drawText("Variedad", { x: margen, y, size: 7, font: bold, color: NEGRO });
  page.drawText("Band.", { x: ANCHO - margen - 90, y, size: 7, font: bold, color: NEGRO });
  page.drawText("Neto (kg)", { x: ANCHO - margen - 50, y, size: 7, font: bold, color: NEGRO });
  y -= 12;

  for (const linea of lineas) {
    if (y < 90) break; // seguridad: no desbordar la etiqueta si hay muchas líneas
    page.drawText(linea.variedad, { x: margen, y, size: 7, font: regular, color: NEGRO });
    page.drawText(String(linea.cantidadBandejas), { x: ANCHO - margen - 90, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.pesoNetoKg.toFixed(2), { x: ANCHO - margen - 50, y, size: 7, font: regular, color: NEGRO });
    y -= 11;
    page.drawText(`  Bandeja: ${linea.tipoBandeja}`, { x: margen, y, size: 6, font: regular, color: GRIS });
    y -= 13;
  }

  y -= 4;
  page.drawLine({ start: { x: margen, y }, end: { x: ANCHO - margen, y }, thickness: 0.5, color: GRIS });
  y -= 16;

  page.drawText("Total bandejas:", { x: margen, y, size: 8, font: regular, color: GRIS });
  page.drawText(String(totalBandejas), { x: ANCHO - margen - 40, y, size: 9, font: bold, color: NEGRO });
  y -= 13;
  page.drawText("Peso bruto:", { x: margen, y, size: 8, font: regular, color: GRIS });
  page.drawText(`${pesoBrutoTotalKg.toFixed(2)} kg`, { x: ANCHO - margen - 60, y, size: 9, font: bold, color: NEGRO });
  y -= 13;
  page.drawText("Tara:", { x: margen, y, size: 8, font: regular, color: GRIS });
  page.drawText(`${pesoTaraTotalKg.toFixed(2)} kg`, { x: ANCHO - margen - 60, y, size: 9, font: bold, color: NEGRO });
  y -= 15;
  page.drawText("PESO NETO:", { x: margen, y, size: 10, font: bold, color: AZUL });
  page.drawText(`${pesoNetoTotalKg.toFixed(2)} kg`, { x: ANCHO - margen - 65, y, size: 12, font: bold, color: AZUL });

  page.drawText(
    "Documento interno — no válido como comprobante SUNAT.",
    { x: margen, y: 16, size: 5.5, font: regular, color: GRIS }
  );

  return pdfDoc.save();
}
