import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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
  gestionadoPor,
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
  /** Código (ver codigoAprobador en lib/utils.ts) del Comprador que registró este avance. */
  gestionadoPor: string | null;
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
  // 135 (no 95) para que quepa la etiqueta más larga, "FECHA DE
  // APROBACIÓN:", sin pisar el valor — se veía superpuesto antes.
  const xValor = MARGEN_X + 135;
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
  y -= 24;

  // ---------------------------------------------------------------------
  // Pie: trazabilidad de quién gestionó y quién aprobó — mismo formato que
  // el pie de la Orden de Compra (ver filaPie en orden-compra-pdf.ts),
  // pegado a continuación de donde haya terminado el total (dinámico: si
  // el total se corrió de página, este pie baja con él).
  // ---------------------------------------------------------------------
  if (y < MARGEN_INFERIOR - 22) nuevaPagina();
  const filaPie = (label: string, value: string) => {
    page.drawText(label, { x: MARGEN_X, y, size: 7, font: bold, color: GRIS });
    page.drawText(value, { x: MARGEN_X + 125, y, size: 7, font: regular, color: NEGRO });
    y -= 11;
  };
  filaPie("GESTIONADO POR:", gestionadoPor || "—");
  filaPie("APROBADO POR:", aprobadoPor.length > 0 ? aprobadoPor.join("; ") : "—");

  return pdfDoc.save();
}

export type SustentoParaFusion = { nombreArchivo: string; bytes: Uint8Array };

function extension(nombreArchivo: string): string {
  const i = nombreArchivo.lastIndexOf(".");
  return i === -1 ? "" : nombreArchivo.slice(i + 1).toLowerCase();
}

const EXTENSIONES_IMAGEN = new Set(["jpg", "jpeg", "png"]);

// Glosa fija en la parte de arriba de cada hoja de sustento (pedido
// explícito): una banda blanca para que se lea encima de lo que haya
// debajo (un PDF escaneado, una foto), con el texto centrado y achicado
// si la hoja es más angosta de lo normal (un comprobante, no A4).
function dibujarGlosaAprobacion(pagina: PDFPage, font: PDFFont, texto: string) {
  const { width, height } = pagina.getSize();
  const altoBanda = 18;
  let size = 9;
  while (size > 6 && font.widthOfTextAtSize(texto, size) > width - 16) size -= 0.5;
  pagina.drawRectangle({ x: 0, y: height - altoBanda, width, height: altoBanda, color: rgb(1, 1, 1), opacity: 0.88 });
  pagina.drawLine({
    start: { x: 0, y: height - altoBanda },
    end: { x: width, y: height - altoBanda },
    thickness: 0.5,
    color: GRIS_CLARO,
  });
  const anchoTexto = font.widthOfTextAtSize(texto, size);
  pagina.drawText(texto, {
    x: (width - anchoTexto) / 2,
    y: height - altoBanda + (altoBanda - size) / 2 - 1,
    size,
    font,
    color: NEGRO,
  });
}

// Hoja de reemplazo para un sustento cuyo formato pdf-lib no puede
// incrustar (Word/Excel, o un PDF/imagen corrupto) — nunca se omite en
// silencio, siempre queda constancia de que ese sustento existe.
function agregarPaginaNoCompatible(doc: PDFDocument, bold: PDFFont, regular: PDFFont, nombreArchivo: string, glosa: string) {
  const pagina = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  dibujarGlosaAprobacion(pagina, bold, glosa);
  pagina.drawText("Sustento adjunto:", { x: MARGEN_X, y: ALTO_PAGINA - 80, size: 11, font: bold, color: NEGRO });
  pagina.drawText(nombreArchivo, { x: MARGEN_X, y: ALTO_PAGINA - 96, size: 10, font: regular, color: NEGRO });
  pagina.drawText("Este formato no se pudo incorporar automáticamente a este PDF.", {
    x: MARGEN_X,
    y: ALTO_PAGINA - 116,
    size: 9,
    font: regular,
    color: GRIS,
  });
  pagina.drawText("Descárguelo por separado desde la sección Sustento del registro de avance.", {
    x: MARGEN_X,
    y: ALTO_PAGINA - 130,
    size: 9,
    font: regular,
    color: GRIS,
  });
}

// Une el Acta (ya generada) con los sustentos del registro, en el orden
// en que se subieron: el Acta queda de primera hoja, cada sustento PDF
// aporta sus propias páginas y cada imagen (jpg/png) se agrega como una
// hoja — todas con la glosa "APROBADO POR: ..." encima (mismo texto que
// el pie del Acta). Un formato que pdf-lib no puede incrustar (Word/
// Excel, webp/heic, un archivo corrupto) no se pierde: queda como una
// hoja de aviso en su lugar, ver agregarPaginaNoCompatible.
export async function fusionarActaConSustentos(
  actaBytes: Uint8Array,
  sustentos: SustentoParaFusion[],
  aprobadoPor: string[]
): Promise<Uint8Array> {
  const glosa = `APROBADO POR: ${aprobadoPor.length > 0 ? aprobadoPor.join("; ") : "—"}`;
  if (sustentos.length === 0) return actaBytes;

  const finalDoc = await PDFDocument.load(actaBytes);
  const bold = await finalDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await finalDoc.embedFont(StandardFonts.Helvetica);

  for (const sustento of sustentos) {
    const ext = extension(sustento.nombreArchivo);
    if (ext === "pdf") {
      try {
        const srcDoc = await PDFDocument.load(sustento.bytes, { ignoreEncryption: true });
        const copiadas = await finalDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        for (const pagina of copiadas) {
          finalDoc.addPage(pagina);
          dibujarGlosaAprobacion(pagina, bold, glosa);
        }
      } catch {
        agregarPaginaNoCompatible(finalDoc, bold, regular, sustento.nombreArchivo, glosa);
      }
    } else if (EXTENSIONES_IMAGEN.has(ext)) {
      try {
        const imagen = ext === "png" ? await finalDoc.embedPng(sustento.bytes) : await finalDoc.embedJpg(sustento.bytes);
        const maxAncho = ANCHO_PAGINA - 72;
        const maxAlto = ALTO_PAGINA - 110;
        const escala = Math.min(maxAncho / imagen.width, maxAlto / imagen.height, 1);
        const w = imagen.width * escala;
        const h = imagen.height * escala;
        const pagina = finalDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
        pagina.drawImage(imagen, { x: (ANCHO_PAGINA - w) / 2, y: (ALTO_PAGINA - h) / 2 - 10, width: w, height: h });
        dibujarGlosaAprobacion(pagina, bold, glosa);
      } catch {
        agregarPaginaNoCompatible(finalDoc, bold, regular, sustento.nombreArchivo, glosa);
      }
    } else {
      agregarPaginaNoCompatible(finalDoc, bold, regular, sustento.nombreArchivo, glosa);
    }
  }

  return finalDoc.save();
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
