import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// Parte un texto en líneas que caben en `anchoMax` (igual que en los demás
// generadores de lib/pdf/, con un máximo de líneas más corto porque este
// recibo es angosto).
function envolverTexto(texto: string, font: PDFFont, size: number, anchoMax: number, maxLineas = 2): string[] {
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

const GRIS = rgb(0.45, 0.45, 0.45);
const GRIS_CLARO = rgb(0.85, 0.85, 0.85);
const NEGRO = rgb(0.1, 0.1, 0.1);

// Formato "recibo angosto", pensado para leerse en la pantalla de un
// celular (o imprimirse en una impresora térmica de 80mm) — no A4: el
// alto se ajusta exactamente al contenido, no hay paginación.
const ANCHO_PAGINA = 300;
const MARGEN = 16;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

export type LineaConsumoPdf = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
};

export async function generarConsumoAlmacenPdf({
  numero,
  almacen,
  fecha,
  horaRetiro,
  retiradoPor,
  registradoPor,
  observaciones,
  lineas,
  firmaPngBytes,
}: {
  numero: string;
  almacen: string;
  fecha: Date;
  horaRetiro: string | null;
  retiradoPor: string;
  registradoPor: string;
  observaciones: string | null;
  lineas: LineaConsumoPdf[];
  firmaPngBytes: Uint8Array | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-rpb.jpg"));
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoAltura = 20;
  const logoAncho = (logo.width / logo.height) * logoAltura;

  let firma: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  let firmaAncho = 0;
  let firmaAlto = 0;
  if (firmaPngBytes) {
    firma = await pdfDoc.embedPng(firmaPngBytes);
    const escalaAncho = ANCHO_UTIL / firma.width;
    firmaAncho = firma.width * escalaAncho;
    firmaAlto = firma.height * escalaAncho;
    if (firmaAlto > 70) {
      const escalaAlto = 70 / firma.height;
      firmaAncho = firma.width * escalaAlto;
      firmaAlto = 70;
    }
  }

  // Líneas ya envueltas de cada ítem/observación, calculadas ANTES de saber
  // el alto de la página (acá no hay paginación: el alto se ajusta al
  // contenido, así que hay que medirlo primero para poder crear la página).
  const lineasPorItem = lineas.map((l) => envolverTexto(`${l.codigo} — ${l.descripcion}`, regular, 8, ANCHO_UTIL, 2));
  const lineasObservaciones = observaciones ? envolverTexto(observaciones, regular, 7, ANCHO_UTIL, 3) : [];

  const altoHeader = logoAltura + 4 + 10 + 10 + 14;
  const altoTitulo = 16;
  const altoDatos = 4 * 22; // almacén, fecha/hora, retirado por, registrado por
  const altoDivisorItems = 10 + 12;
  const altoItems = lineasPorItem.reduce((acc, titulo) => acc + titulo.length * 9 + 9 + 6, 0);
  const altoObservaciones = lineasObservaciones.length > 0 ? 9 + lineasObservaciones.length * 9 + 5 : 0;
  const altoFirma = 10 + (firma ? firmaAlto + 8 : 16);
  const altoFooter = 16;

  const altoTotal =
    MARGEN * 2 + altoHeader + altoTitulo + altoDatos + altoDivisorItems + altoItems + altoObservaciones + altoFirma + altoFooter;

  const page = pdfDoc.addPage([ANCHO_PAGINA, altoTotal]);
  let y = altoTotal - MARGEN;

  page.drawImage(logo, { x: MARGEN, y: y - logoAltura, width: logoAncho, height: logoAltura });
  y -= logoAltura + 4;
  page.drawText("REITER PERUVIAN BERRY SA", { x: MARGEN, y, size: 8, font: bold, color: NEGRO });
  y -= 10;
  page.drawText("RUC: 20610390341", { x: MARGEN, y, size: 6, font: regular, color: GRIS });
  y -= 10;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO_PAGINA - MARGEN, y }, thickness: 0.75, color: NEGRO });
  y -= 14;

  page.drawText(`CONSUMO ${numero}`, { x: MARGEN, y, size: 11, font: bold, color: NEGRO });
  y -= 16;

  function filaDato(label: string, value: string) {
    page.drawText(label, { x: MARGEN, y, size: 7, font: bold, color: GRIS });
    y -= 9;
    page.drawText(value, { x: MARGEN, y, size: 8, font: regular, color: NEGRO });
    y -= 13;
  }
  filaDato("ALMACÉN", almacen);
  filaDato("FECHA Y HORA", `${fecha.toLocaleDateString("es-PE")}${horaRetiro ? ` ${horaRetiro}` : ""}`);
  filaDato("RETIRADO POR", retiradoPor);
  filaDato("REGISTRADO POR", registradoPor);

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO_PAGINA - MARGEN, y }, thickness: 0.5, color: GRIS_CLARO });
  y -= 10;
  page.drawText("PRODUCTOS", { x: MARGEN, y, size: 7, font: bold, color: GRIS });
  y -= 12;

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    for (const l of lineasPorItem[i]) {
      page.drawText(l, { x: MARGEN, y, size: 8, font: regular, color: NEGRO });
      y -= 9;
    }
    page.drawText(`Cantidad: ${linea.cantidad} ${linea.unidadMedida}`, { x: MARGEN, y, size: 7, font: bold, color: NEGRO });
    y -= 9;
    if (i < lineas.length - 1) {
      page.drawLine({
        start: { x: MARGEN, y: y + 3 },
        end: { x: ANCHO_PAGINA - MARGEN, y: y + 3 },
        thickness: 0.3,
        color: GRIS_CLARO,
      });
    }
    y -= 6;
  }

  if (lineasObservaciones.length > 0) {
    page.drawText("OBSERVACIONES", { x: MARGEN, y, size: 7, font: bold, color: GRIS });
    y -= 9;
    for (const l of lineasObservaciones) {
      page.drawText(l, { x: MARGEN, y, size: 7, font: regular, color: NEGRO });
      y -= 9;
    }
    y -= 5;
  }

  page.drawText("FIRMA DE QUIEN RETIRA", { x: MARGEN, y, size: 7, font: bold, color: GRIS });
  y -= 10;
  if (firma) {
    page.drawImage(firma, { x: MARGEN, y: y - firmaAlto, width: firmaAncho, height: firmaAlto });
    y -= firmaAlto + 8;
  } else {
    page.drawText("(sin firma)", { x: MARGEN, y: y - 8, size: 7, font: regular, color: GRIS });
    y -= 16;
  }

  page.drawLine({ start: { x: MARGEN, y: y + 8 }, end: { x: ANCHO_PAGINA - MARGEN, y: y + 8 }, thickness: 0.5, color: GRIS_CLARO });
  page.drawText("Evidencia fotográfica del despacho adjunta en el sistema.", {
    x: MARGEN,
    y,
    size: 6,
    font: regular,
    color: GRIS,
  });

  return pdfDoc.save();
}
