import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const GRIS = rgb(0.35, 0.35, 0.35);
const GRIS_CLARO = rgb(0.88, 0.88, 0.88);
const NEGRO = rgb(0.05, 0.05, 0.05);

const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const MARGEN_X = 36;
const MARGEN_INFERIOR = 90;

// Posiciones X de columnas de la tabla de avances.
const COL = {
  item: MARGEN_X,
  codigo: MARGEN_X + 24,
  descripcion: MARGEN_X + 84,
  um: MARGEN_X + 300,
  cantidad: MARGEN_X + 328,
  unitario: MARGEN_X + 392,
  valorizado: MARGEN_X + 458,
};

export type LineaActaServicioPdf = {
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidadAvanzada: number;
  precioUnitario: number;
  valorizado: number;
};

// Documento que certifica que un Registro de Avance de una Orden de
// Servicio ya quedó totalmente APROBADO — pedido explícito: solo se
// genera cuando TODAS sus líneas tienen VB (ver el guard en
// app/api/pdf/acta-servicio/[registroAvanceId]/route.ts, que es quien
// decide si corresponde emitirla, este generador no vuelve a validarlo).
export async function generarActaServicioPdf({
  numeroOrden,
  numeroRegistro,
  fechaDecision,
  proveedor,
  rucProveedor,
  moneda,
  lineas,
  montoTotal,
  aprobadoPor,
}: {
  numeroOrden: string;
  numeroRegistro: number;
  fechaDecision: Date;
  proveedor: string;
  rucProveedor: string;
  moneda: string;
  lineas: LineaActaServicioPdf[];
  montoTotal: number;
  /** Códigos (ver codigoAprobador en lib/utils.ts) de quienes dieron VB, ya sin duplicados. */
  aprobadoPor: string[];
}): Promise<Uint8Array> {
  proveedor = proveedor.toUpperCase();
  lineas = lineas.map((l) => ({ ...l, codigo: l.codigo.toUpperCase(), descripcion: l.descripcion.toUpperCase(), unidadMedida: l.unidadMedida.toUpperCase() }));

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-rpb.jpg"));
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoAltura = 44;
  const logoAncho = (logo.width / logo.height) * logoAltura;

  const moneyFmt = (n: number) => new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  let page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - 40;

  function drawTextRight(texto: string, xDerecha: number, yTexto: number, size: number, font: PDFFont) {
    const ancho = font.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: xDerecha - ancho, y: yTexto, size, font, color: NEGRO });
  }

  // ---------------------------------------------------------------------
  // Encabezado: logo + razón social/RUC, título del documento a la
  // derecha con el número de OS y de registro debajo.
  // ---------------------------------------------------------------------
  const yLogoSuperior = y;
  page.drawImage(logo, { x: MARGEN_X, y: y - logoAltura + 8, width: logoAncho, height: logoAltura });

  const sizeCaja = 11;
  const tituloCaja = "ACTA DE ACEPTACIÓN DE SERVICIO";
  const anchoTitulo = bold.widthOfTextAtSize(tituloCaja, sizeCaja);
  page.drawText(tituloCaja, { x: ANCHO_PAGINA - MARGEN_X - anchoTitulo, y, size: sizeCaja, font: bold, color: NEGRO });
  const subtitulo = `${numeroOrden} — REGISTRO DE AVANCE ${numeroRegistro}`;
  const anchoSubtitulo = regular.widthOfTextAtSize(subtitulo, 9);
  page.drawText(subtitulo, { x: ANCHO_PAGINA - MARGEN_X - anchoSubtitulo, y: y - 14, size: 9, font: regular, color: GRIS });

  let yEmpresa = yLogoSuperior - logoAltura + 8 - 12;
  page.drawText("REITER PERUVIAN BERRY S.A", { x: MARGEN_X, y: yEmpresa, size: 10, font: bold, color: NEGRO });
  yEmpresa -= 12;
  const anchoEtiquetaRuc = bold.widthOfTextAtSize("RUC: ", 8);
  page.drawText("RUC: ", { x: MARGEN_X, y: yEmpresa, size: 8, font: bold, color: NEGRO });
  page.drawText("20610390341", { x: MARGEN_X + anchoEtiquetaRuc, y: yEmpresa, size: 8, font: regular, color: NEGRO });

  y = Math.min(yLogoSuperior - logoAltura + 8, yEmpresa) - 14;
  page.drawLine({ start: { x: MARGEN_X, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 1, color: NEGRO });
  y -= 20;

  // ---------------------------------------------------------------------
  // Datos del proveedor y del servicio.
  // ---------------------------------------------------------------------
  const xEtiqueta = MARGEN_X;
  const xValor = MARGEN_X + 95;
  const filaDato = (label: string, value: string) => {
    page.drawText(label, { x: xEtiqueta, y, size: 8, font: bold, color: GRIS });
    page.drawText(value, { x: xValor, y, size: 8, font: regular, color: NEGRO });
    y -= 13;
  };
  filaDato("PROVEEDOR:", proveedor);
  filaDato("RUC:", rucProveedor || "—");
  filaDato("FECHA DE APROBACIÓN:", fechaDecision.toLocaleDateString("es-PE"));
  filaDato("MONEDA:", moneda);
  y -= 10;

  page.drawText(
    "Se deja constancia de que el servicio detallado a continuación fue prestado y aceptado conforme, con el visto bueno de los responsables indicados al pie.",
    { x: MARGEN_X, y, size: 8, font: regular, color: NEGRO }
  );
  y -= 20;

  // ---------------------------------------------------------------------
  // Tabla de avances aprobados.
  // ---------------------------------------------------------------------
  function dibujarEncabezadoTabla() {
    page.drawLine({ start: { x: MARGEN_X, y: y + 10 }, end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 10 }, thickness: 0.75, color: NEGRO });
    page.drawLine({ start: { x: MARGEN_X, y: y - 3 }, end: { x: ANCHO_PAGINA - MARGEN_X, y: y - 3 }, thickness: 0.75, color: NEGRO });
    page.drawText("ITEM", { x: COL.item + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("CÓDIGO", { x: COL.codigo + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("DESCRIPCIÓN", { x: COL.descripcion + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("UM", { x: COL.um + 2, y, size: 7, font: bold, color: NEGRO });
    drawTextRight("CANT. APROB.", COL.unitario - 4, y, 7, bold);
    drawTextRight("P. UNITARIO", COL.valorizado - 4, y, 7, bold);
    drawTextRight("VALORIZADO", ANCHO_PAGINA - MARGEN_X - 2, y, 7, bold);
    y -= 17;
  }

  function nuevaPagina() {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - 40;
    dibujarEncabezadoTabla();
  }

  dibujarEncabezadoTabla();

  lineas.forEach((linea, idx) => {
    const lineasDescripcion = partirTexto(linea.descripcion, 44).slice(0, 4);
    const alturaFila = 9 * lineasDescripcion.length + 1;
    if (y - alturaFila < MARGEN_INFERIOR) nuevaPagina();
    page.drawText(String(idx + 1), { x: COL.item + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.codigo, { x: COL.codigo + 2, y, size: 7, font: regular, color: NEGRO });
    for (let i = 0; i < lineasDescripcion.length; i++) {
      page.drawText(lineasDescripcion[i], { x: COL.descripcion + 2, y: y - i * 9, size: 7, font: regular, color: NEGRO });
    }
    page.drawText(linea.unidadMedida, { x: COL.um + 2, y, size: 7, font: regular, color: NEGRO });
    drawTextRight(linea.cantidadAvanzada.toFixed(2), COL.unitario - 4, y, 7, regular);
    drawTextRight(moneyFmt(linea.precioUnitario), COL.valorizado - 4, y, 7, regular);
    drawTextRight(moneyFmt(linea.valorizado), ANCHO_PAGINA - MARGEN_X - 2, y, 7, regular);
    y -= alturaFila;
    page.drawLine({ start: { x: MARGEN_X, y: y + 3 }, end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 3 }, thickness: 0.3, color: GRIS_CLARO });
    y -= 5;
  });

  y -= 4;
  if (y < MARGEN_INFERIOR + 40) nuevaPagina();
  page.drawLine({ start: { x: ANCHO_PAGINA - MARGEN_X - 200, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 0.5, color: GRIS });
  y -= 15;
  page.drawText("TOTAL VALORIZADO", { x: ANCHO_PAGINA - MARGEN_X - 200, y, size: 9, font: bold, color: NEGRO });
  page.drawText(moneda, { x: ANCHO_PAGINA - MARGEN_X - 95, y, size: 9, font: bold, color: NEGRO });
  drawTextRight(moneyFmt(montoTotal), ANCHO_PAGINA - MARGEN_X - 2, y, 9, bold);
  y -= 40;

  // ---------------------------------------------------------------------
  // Pie: firma de quien(es) dio el VB.
  // ---------------------------------------------------------------------
  const altoFirma = 50;
  if (y < MARGEN_INFERIOR + altoFirma) nuevaPagina();
  y -= 20;
  const textoAprobado = `APROBADO POR: ${aprobadoPor.length > 0 ? aprobadoPor.join("; ") : "—"}`;
  const anchoLinea = Math.min(260, ANCHO_PAGINA - MARGEN_X * 2);
  const xFirma = (ANCHO_PAGINA - anchoLinea) / 2;
  page.drawLine({ start: { x: xFirma, y }, end: { x: xFirma + anchoLinea, y }, thickness: 0.75, color: NEGRO });
  y -= 12;
  const anchoTextoAprobado = bold.widthOfTextAtSize(textoAprobado, 9);
  page.drawText(textoAprobado, { x: (ANCHO_PAGINA - anchoTextoAprobado) / 2, y, size: 9, font: bold, color: NEGRO });

  return pdfDoc.save();
}

function partirTexto(texto: string, max: number): string[] {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > max && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}
