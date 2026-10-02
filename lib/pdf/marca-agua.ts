import { PDFDocument, PDFFont, rgb, degrees } from "pdf-lib";

// Marca de agua "DRAFT" diagonal en todas las páginas de un PDF, usada en
// Solicitud de pedido y Orden de compra/servicio mientras el documento no
// esté APROBADO. Desaparece en cuanto queda aprobado.
export function dibujarMarcaDeAguaDraft(pdfDoc: PDFDocument, font: PDFFont) {
  const texto = "DRAFT";
  const tamano = 100;
  const anchoTexto = font.widthOfTextAtSize(texto, tamano);
  for (const pagina of pdfDoc.getPages()) {
    const { width, height } = pagina.getSize();
    pagina.drawText(texto, {
      x: width / 2 - anchoTexto / 2,
      y: height / 2 - tamano / 3,
      size: tamano,
      font,
      color: rgb(0.8, 0.15, 0.15),
      opacity: 0.25,
      rotate: degrees(40),
    });
  }
}
