import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.4, 0.4, 0.4);

// Nombre (y cargo, si lo tiene) de quien aprobó, centrado al pie de la
// última página — solo se llama cuando el documento ya está APROBADO.
export function dibujarFirmaAprobacion(
  page: PDFPage,
  { nombre, cargo }: { nombre: string; cargo: string | null },
  regular: PDFFont,
  bold: PDFFont
) {
  const { width } = page.getSize();
  const yLinea = 58;
  const anchoLinea = 180;
  const xLinea = width / 2 - anchoLinea / 2;

  const textoEtiqueta = "APROBADO POR:";
  const anchoEtiqueta = bold.widthOfTextAtSize(textoEtiqueta, 7);
  page.drawText(textoEtiqueta, { x: width / 2 - anchoEtiqueta / 2, y: yLinea + 10, size: 7, font: bold, color: GRIS });

  page.drawLine({
    start: { x: xLinea, y: yLinea },
    end: { x: xLinea + anchoLinea, y: yLinea },
    thickness: 0.5,
    color: GRIS,
  });

  const anchoNombre = bold.widthOfTextAtSize(nombre, 10);
  page.drawText(nombre, { x: width / 2 - anchoNombre / 2, y: yLinea - 14, size: 10, font: bold, color: NEGRO });

  if (cargo) {
    const anchoCargo = regular.widthOfTextAtSize(cargo, 8);
    page.drawText(cargo, { x: width / 2 - anchoCargo / 2, y: yLinea - 26, size: 8, font: regular, color: GRIS });
  }
}
