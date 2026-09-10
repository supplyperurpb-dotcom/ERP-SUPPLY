import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Plantilla base de PDF para la fase de scaffold. Fase 2 la reemplazará (o
// la reutilizará) por plantillas específicas de Tarja, Guía de Remisión y
// Packing List con el detalle completo exigido por cada documento.
export type FilaDocumentoPdf = { label: string; value: string };

const AZUL = rgb(0.11, 0.29, 0.63);
const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.6, 0.6, 0.6);

export async function generarDocumentoPruebaPdf({
  titulo,
  numero,
  filas,
}: {
  titulo: string;
  numero: string;
  filas: FilaDocumentoPdf[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 en puntos
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margenX = 40;
  let y = 800;

  page.drawText("Empresa Agroexportadora de Arándanos S.A.C.", {
    x: margenX,
    y,
    size: 12,
    font: fontBold,
    color: AZUL,
  });
  y -= 16;
  page.drawText(
    "Ica, Perú — Documento interno generado por el sistema (no válido como comprobante SUNAT)",
    { x: margenX, y, size: 8, font: fontRegular, color: GRIS }
  );
  y -= 8;
  page.drawLine({
    start: { x: margenX, y },
    end: { x: 555, y },
    thickness: 1,
    color: AZUL,
  });
  y -= 28;

  page.drawText(`${titulo} — ${numero}`, {
    x: margenX,
    y,
    size: 14,
    font: fontBold,
  });
  y -= 24;

  for (const fila of filas) {
    page.drawText(fila.label, { x: margenX, y, size: 10, font: fontRegular, color: GRIS });
    page.drawText(fila.value, { x: margenX + 200, y, size: 10, font: fontBold });
    y -= 12;
    page.drawLine({
      start: { x: margenX, y },
      end: { x: 555, y },
      thickness: 0.5,
      color: GRIS_CLARO,
    });
    y -= 12;
  }

  page.drawText(
    "Documento de prueba — fase de scaffold. La integración con SUNAT/OSE se implementará en una fase posterior.",
    { x: margenX, y: 40, size: 8, font: fontRegular, color: GRIS_CLARO }
  );

  return pdfDoc.save();
}
