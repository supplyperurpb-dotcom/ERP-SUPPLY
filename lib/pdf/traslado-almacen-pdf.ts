import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// Parte un texto en líneas que caben en `anchoMax`, hasta un máximo de líneas.
function envolverTexto(texto: string, font: PDFFont, size: number, anchoMax: number, maxLineas = 4): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(candidata, size) <= anchoMax) {
      actual = candidata;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const resto = lineas.slice(0, maxLineas);
    let ultima = resto[maxLineas - 1];
    while (font.widthOfTextAtSize(`${ultima}…`, size) > anchoMax && ultima.length > 1) {
      ultima = ultima.slice(0, -1);
    }
    resto[maxLineas - 1] = `${ultima}…`;
    return resto;
  }
  return lineas.length > 0 ? lineas : [""];
}

const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.85, 0.85, 0.85);
const NEGRO = rgb(0.1, 0.1, 0.1);

const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const MARGEN_X = 40;
const MARGEN_INFERIOR = 70;

export type LineaActaTrasladoPdf = {
  codigo: string;
  descripcion: string;
  lote: string | null;
  cantidadTrasladada: number;
  unidadMedida: string;
};

// Acta de traslado: el comprobante de un TrasladoAlmacen -- operación
// directa entre almacenes, sin solicitud previa (ver lib/actions/traslado-almacen-actions.ts).
export async function generarActaTrasladoPdf({
  numero,
  almacenOrigen,
  almacenDestino,
  fecha,
  guiaRemision,
  remitente,
  observaciones,
  lineas,
}: {
  numero: string;
  almacenOrigen: string;
  almacenDestino: string;
  fecha: Date;
  guiaRemision: string | null;
  remitente: string | null;
  observaciones: string | null;
  lineas: LineaActaTrasladoPdf[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-rpb.jpg"));
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoAltura = 32;
  const logoAncho = (logo.width / logo.height) * logoAltura;

  let page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - 50;

  const hayLotes = lineas.some((l) => l.lote);

  const columnas = hayLotes
    ? [
        { titulo: "Código", x: MARGEN_X, ancho: 55 },
        { titulo: "Producto", x: MARGEN_X + 55, ancho: 195 },
        { titulo: "Lote", x: MARGEN_X + 250, ancho: 90 },
        { titulo: "Trasladado", x: MARGEN_X + 340, ancho: 90 },
        { titulo: "U.M.", x: MARGEN_X + 430, ancho: 65 },
      ]
    : [
        { titulo: "Código", x: MARGEN_X, ancho: 60 },
        { titulo: "Producto", x: MARGEN_X + 60, ancho: 330 },
        { titulo: "Trasladado", x: MARGEN_X + 390, ancho: 90 },
        { titulo: "U.M.", x: MARGEN_X + 480, ancho: 55 },
      ];

  function dibujarEncabezadoTabla() {
    page.drawLine({
      start: { x: MARGEN_X, y: y + 10 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 10 },
      thickness: 0.75,
      color: NEGRO,
    });
    page.drawLine({
      start: { x: MARGEN_X, y: y - 4 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y - 4 },
      thickness: 0.75,
      color: NEGRO,
    });
    for (const col of columnas) {
      page.drawText(col.titulo, { x: col.x + 3, y, size: 8, font: bold, color: NEGRO });
    }
    y -= 20;
  }

  function nuevaPagina() {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - 50;
    dibujarEncabezadoTabla();
  }

  const yLogoSuperior = y;
  page.drawImage(logo, { x: MARGEN_X, y: y - logoAltura + 8, width: logoAncho, height: logoAltura });

  const sizeTitulo = 11;
  const tituloCompleto = `ACTA DE TRASLADO ${numero}`;
  const anchoTitulo = bold.widthOfTextAtSize(tituloCompleto, sizeTitulo);
  page.drawText(tituloCompleto, {
    x: ANCHO_PAGINA - MARGEN_X - anchoTitulo,
    y,
    size: sizeTitulo,
    font: bold,
    color: NEGRO,
  });

  let yEmpresa = yLogoSuperior - logoAltura + 8 - 12;
  page.drawText("REITER PERUVIAN BERRY SA", { x: MARGEN_X, y: yEmpresa, size: 11, font: bold, color: NEGRO });
  yEmpresa -= 12;
  const anchoEtiquetaRuc = bold.widthOfTextAtSize("RUC: ", 8);
  page.drawText("RUC: ", { x: MARGEN_X, y: yEmpresa, size: 8, font: bold, color: NEGRO });
  page.drawText("20610390341", { x: MARGEN_X + anchoEtiquetaRuc, y: yEmpresa, size: 8, font: regular, color: NEGRO });
  yEmpresa -= 11;
  page.drawText("AV. DE LA FLORESTA NRO. 497 INT. 203 URB. CHACARILLA DEL ESTANQUE LIMA - LIMA - SAN BORJA", {
    x: MARGEN_X,
    y: yEmpresa,
    size: 7,
    font: regular,
    color: NEGRO,
  });
  y = Math.min(yLogoSuperior - logoAltura + 8, yEmpresa) - 14;
  page.drawLine({ start: { x: MARGEN_X, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 1, color: NEGRO });
  y -= 20;

  const colDatoX = MARGEN_X + 110;
  const colDatoX2 = MARGEN_X + 320;
  const filaDato = (label: string, value: string, col2Label?: string, col2Value?: string) => {
    page.drawText(label, { x: MARGEN_X, y, size: 9, font: bold, color: GRIS });
    page.drawText(value, { x: colDatoX, y, size: 9, font: regular, color: NEGRO });
    if (col2Label) {
      page.drawText(col2Label, { x: colDatoX2, y, size: 9, font: bold, color: GRIS });
      page.drawText(col2Value ?? "", { x: colDatoX2 + 90, y, size: 9, font: regular, color: NEGRO });
    }
    y -= 14;
  };
  filaDato("Almacén origen:", almacenOrigen, "Almacén destino:", almacenDestino);
  filaDato("Fecha:", fecha.toLocaleDateString("es-PE"), "Remitente:", remitente ?? "—");
  filaDato("Guía de remisión:", guiaRemision ?? "—");
  if (observaciones) {
    page.drawText("Observaciones:", { x: MARGEN_X, y, size: 9, font: bold, color: GRIS });
    page.drawText(truncar(observaciones, 85), { x: colDatoX, y, size: 9, font: regular, color: NEGRO });
    y -= 14;
  }
  y -= 10;

  dibujarEncabezadoTabla();

  const colDescripcion = columnas[1];
  const colLote = hayLotes ? columnas[2] : null;
  const colTrasladado = hayLotes ? columnas[3] : columnas[2];
  const colUm = hayLotes ? columnas[4] : columnas[3];

  for (const linea of lineas) {
    const lineasDescripcion = envolverTexto(linea.descripcion, regular, 8, colDescripcion.ancho - 6);
    const alturaFila = 10 * lineasDescripcion.length + 2;
    if (y - alturaFila < MARGEN_INFERIOR) nuevaPagina();

    page.drawText(linea.codigo, { x: columnas[0].x + 3, y, size: 8, font: regular, color: NEGRO });
    for (let i = 0; i < lineasDescripcion.length; i++) {
      page.drawText(lineasDescripcion[i], { x: colDescripcion.x + 3, y: y - i * 10, size: 8, font: regular, color: NEGRO });
    }
    if (colLote) {
      page.drawText(linea.lote ?? "—", { x: colLote.x + 3, y, size: 8, font: regular, color: NEGRO });
    }
    page.drawText(String(linea.cantidadTrasladada), { x: colTrasladado.x + 3, y, size: 8, font: bold, color: NEGRO });
    page.drawText(linea.unidadMedida, { x: colUm.x + 3, y, size: 8, font: regular, color: NEGRO });
    y -= alturaFila;
    page.drawLine({
      start: { x: MARGEN_X, y: y + 4 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 4 },
      thickness: 0.4,
      color: GRIS_CLARO,
    });
    y -= 4;
  }

  y -= 30;
  if (y - 60 < MARGEN_INFERIOR) nuevaPagina();
  const anchoFirma = 180;
  const xFirmaIzq = MARGEN_X + 20;
  const xFirmaDer = ANCHO_PAGINA - MARGEN_X - anchoFirma - 20;
  page.drawLine({ start: { x: xFirmaIzq, y }, end: { x: xFirmaIzq + anchoFirma, y }, thickness: 0.75, color: NEGRO });
  page.drawLine({ start: { x: xFirmaDer, y }, end: { x: xFirmaDer + anchoFirma, y }, thickness: 0.75, color: NEGRO });
  y -= 12;
  page.drawText("Entrega (almacén origen)", { x: xFirmaIzq, y, size: 8, font: regular, color: GRIS });
  page.drawText("Recibe (almacén destino)", { x: xFirmaDer, y, size: 8, font: regular, color: GRIS });

  return pdfDoc.save();
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}
