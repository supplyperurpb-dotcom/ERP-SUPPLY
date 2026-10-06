import { PDFDocument, PDFFont, rgb, degrees } from "pdf-lib";

// Marca de agua diagonal en todas las páginas de un PDF, usada en
// Solicitud de pedido y Orden de compra/servicio: "BORRADOR" mientras el
// documento no esté APROBADO, "ANULADA" si quedó anulado. Desaparece en
// cuanto queda aprobado (y nunca se dibuja junto con la firma de
// aprobación: son estados excluyentes).
export function dibujarMarcaDeAgua(pdfDoc: PDFDocument, font: PDFFont, texto: "BORRADOR" | "ANULADA" = "BORRADOR") {
  const tamano = 80;
  const anguloGrados = 40;
  const anguloRad = (anguloGrados * Math.PI) / 180;
  const anchoTexto = font.widthOfTextAtSize(texto, tamano);

  // drawText rota alrededor del punto (x, y) que pasamos, así que para que
  // el texto quede centrado en la hoja ya rotado, hay que ubicar ese punto
  // de anclaje de modo que, tras la rotación, el centro visual del texto
  // (a medio ancho y a una fracción de su alto desde la base) caiga justo
  // en el centro de la página.
  const centroLocalX = anchoTexto / 2;
  const centroLocalY = tamano * 0.35;
  const rotadoX = centroLocalX * Math.cos(anguloRad) - centroLocalY * Math.sin(anguloRad);
  const rotadoY = centroLocalX * Math.sin(anguloRad) + centroLocalY * Math.cos(anguloRad);

  for (const pagina of pdfDoc.getPages()) {
    const { width, height } = pagina.getSize();
    pagina.drawText(texto, {
      x: width / 2 - rotadoX,
      y: height / 2 - rotadoY,
      size: tamano,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.3,
      rotate: degrees(anguloGrados),
    });
  }
}
