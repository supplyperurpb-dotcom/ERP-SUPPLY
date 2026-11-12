import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dibujarMarcaDeAgua } from "./marca-agua";

// 1 cm = 28.3465 pt. Etiqueta cuadrada de 10.16 x 10.16 cm (4x4 pulgadas,
// tamaño estándar de etiquetadora térmica) — antes era 10 x 15 cm.
const CM = 28.3465;
const ANCHO = 10.16 * CM;
const ALTO = 10.16 * CM;

// Todo el texto en negro puro: impreso con cinta ribbon, cualquier color
// (incluido el gris que tenía antes) sale borroso/tenue — pedido explícito
// del usuario, 2026-11-12.
const NEGRO = rgb(0, 0, 0);

export type LineaTarjaIndustrial = {
  variedad: string;
  tipoBandeja: string;
  cantidadBandejas: number;
  pesoNetoKg: number;
};

export async function generarTarjaIndustrialPdf({
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
  palletAbierto,
}: {
  tarjaNumero: string;
  palletNumero: string;
  fechaEmision: Date;
  proveedor: string;
  /** "Descarte Campo" o "Descarte Planta", según el origen del pallet. */
  tipoProducto: string;
  lineas: LineaTarjaIndustrial[];
  totalBandejas: number;
  pesoBrutoTotalKg: number;
  pesoTaraTotalKg: number;
  pesoNetoTotalKg: number;
  /** El pallet todavía admite más bandejas (no se cerró ni llegó a la capacidad máxima): la tarja sale con marca de agua "BORRADOR", igual que una Orden de Compra sin aprobar. */
  palletAbierto: boolean;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([ANCHO, ALTO]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Margen más generoso que antes (pedido explícito: que no salga "al
  // ras" del borde de la etiqueta) — mismo valor a los 4 lados.
  const margen = 20;
  let y = ALTO - margen;

  const centrado = (texto: string, tam: number, font = bold) => {
    const ancho = font.widthOfTextAtSize(texto, tam);
    page.drawText(texto, { x: (ANCHO - ancho) / 2, y, size: tam, font, color: NEGRO });
  };

  centrado("REITER PERUVIAN BERRY SA", 6.5, regular);
  y -= 9;
  centrado("Ica, Perú", 5.5, regular);
  y -= 11;
  page.drawLine({ start: { x: margen, y }, end: { x: ANCHO - margen, y }, thickness: 1, color: NEGRO });
  y -= 14;

  centrado("TARJA DE PALLET — Industrial", 10);
  y -= 15;
  centrado(tarjaNumero, 16);
  y -= 18;

  page.drawText(`Pallet: ${palletNumero}`, { x: margen, y, size: 8, font: bold, color: NEGRO });
  y -= 11;
  page.drawText(`Fecha: ${fechaEmision.toLocaleDateString("es-PE")}`, {
    x: margen,
    y,
    size: 7,
    font: regular,
    color: NEGRO,
  });
  y -= 10;
  page.drawText(`Proveedor / Fundo: ${proveedor}`, { x: margen, y, size: 7, font: regular, color: NEGRO });
  y -= 10;
  page.drawText(`Tipo de producto: ${tipoProducto}`, { x: margen, y, size: 7, font: regular, color: NEGRO });
  y -= 12;

  page.drawLine({ start: { x: margen, y }, end: { x: ANCHO - margen, y }, thickness: 0.5, color: NEGRO });
  y -= 11;

  page.drawText("Variedad", { x: margen, y, size: 6.5, font: bold, color: NEGRO });
  page.drawText("Band.", { x: ANCHO - margen - 85, y, size: 6.5, font: bold, color: NEGRO });
  page.drawText("Neto (kg)", { x: ANCHO - margen - 47, y, size: 6.5, font: bold, color: NEGRO });
  y -= 10;

  for (const linea of lineas) {
    if (y < 95) break; // seguridad: no desbordar la etiqueta si hay muchas líneas
    page.drawText(linea.variedad, { x: margen, y, size: 6.5, font: regular, color: NEGRO });
    page.drawText(String(linea.cantidadBandejas), { x: ANCHO - margen - 85, y, size: 6.5, font: regular, color: NEGRO });
    page.drawText(linea.pesoNetoKg.toFixed(2), { x: ANCHO - margen - 47, y, size: 6.5, font: regular, color: NEGRO });
    y -= 9;
    page.drawText(`  Bandeja: ${linea.tipoBandeja}`, { x: margen, y, size: 5.5, font: regular, color: NEGRO });
    y -= 10;
  }

  y -= 3;
  page.drawLine({ start: { x: margen, y }, end: { x: ANCHO - margen, y }, thickness: 0.5, color: NEGRO });
  y -= 13;

  page.drawText("Total bandejas:", { x: margen, y, size: 7, font: regular, color: NEGRO });
  page.drawText(String(totalBandejas), { x: ANCHO - margen - 38, y, size: 8, font: bold, color: NEGRO });
  y -= 11;
  page.drawText("Peso bruto:", { x: margen, y, size: 7, font: regular, color: NEGRO });
  page.drawText(`${pesoBrutoTotalKg.toFixed(2)} kg`, { x: ANCHO - margen - 55, y, size: 8, font: bold, color: NEGRO });
  y -= 11;
  page.drawText("Tara:", { x: margen, y, size: 7, font: regular, color: NEGRO });
  page.drawText(`${pesoTaraTotalKg.toFixed(2)} kg`, { x: ANCHO - margen - 55, y, size: 8, font: bold, color: NEGRO });
  y -= 13;
  page.drawText("PESO NETO:", { x: margen, y, size: 9, font: bold, color: NEGRO });
  page.drawText(`${pesoNetoTotalKg.toFixed(2)} kg`, { x: ANCHO - margen - 58, y, size: 11, font: bold, color: NEGRO });

  page.drawText("Documento interno — no válido como comprobante SUNAT.", {
    x: margen,
    y: 10,
    size: 5,
    font: regular,
    color: NEGRO,
  });

  if (palletAbierto) dibujarMarcaDeAgua(pdfDoc, bold, "BORRADOR", 30);

  return pdfDoc.save();
}
