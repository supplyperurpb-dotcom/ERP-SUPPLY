import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { dibujarMarcaDeAguaDraft } from "./marca-agua";
import { dibujarFirmaAprobacion } from "./firma-aprobacion";

// Parte un texto en líneas que caben en `anchoMax` (p. ej. la descripción
// de un servicio, que puede ser larga), hasta un máximo de líneas.
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

export type LineaSolicitudPedidoPdf = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  centroCosto: string;
  observaciones: string | null;
};

export async function generarSolicitudPedidoPdf({
  nombreDocumento,
  numero,
  area,
  fecha,
  fechaNecesidad,
  tipoNecesidad,
  solicitante,
  justificacion,
  lineas,
  aprobado,
  aprobadoPor,
}: {
  nombreDocumento: string;
  numero: string;
  area: string;
  fecha: Date;
  fechaNecesidad: Date;
  tipoNecesidad: string;
  solicitante: string;
  justificacion: string | null;
  lineas: LineaSolicitudPedidoPdf[];
  // Mientras no esté aprobada (pendiente de VB, rechazada, borrador), se
  // marca el PDF como borrador para que no se confunda con el documento
  // final. Desaparece en cuanto queda APROBADO.
  aprobado: boolean;
  // Nombre (y cargo) de quien aprobó; se muestra al pie solo si aprobado=true.
  aprobadoPor?: { nombre: string; cargo: string | null } | null;
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

  const columnas = [
    { titulo: "Código", x: MARGEN_X, ancho: 60 },
    { titulo: "Producto", x: MARGEN_X + 60, ancho: 160 },
    { titulo: "Cantidad", x: MARGEN_X + 220, ancho: 55 },
    { titulo: "Centro costo", x: MARGEN_X + 275, ancho: 90 },
    { titulo: "Observación", x: MARGEN_X + 365, ancho: 150 },
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

  // Encabezado: logo con la razón social debajo (no al lado), y el nombre
  // del documento con su número arriba a la derecha.
  const yLogoSuperior = y;
  page.drawImage(logo, { x: MARGEN_X, y: y - logoAltura + 8, width: logoAncho, height: logoAltura });

  const sizeTitulo = 11;
  const tituloCompleto = `${nombreDocumento.toUpperCase()} ${numero}`;
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
  yEmpresa -= 11;
  page.drawText("Ica, Perú — Documento interno (no válido como comprobante SUNAT)", {
    x: MARGEN_X,
    y: yEmpresa,
    size: 7,
    font: regular,
    color: GRIS,
  });

  y = Math.min(yLogoSuperior - logoAltura + 8, yEmpresa) - 14;
  page.drawLine({ start: { x: MARGEN_X, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 1, color: NEGRO });
  y -= 20;

  const colDatoX = MARGEN_X + 110;
  const colDatoX2 = MARGEN_X + 320;
  const filaDato = (label: string, value: string, col2Label?: string, col2Value?: string) => {
    page.drawText(label, { x: MARGEN_X, y, size: 9, font: regular, color: GRIS });
    page.drawText(value, { x: colDatoX, y, size: 9, font: bold, color: NEGRO });
    if (col2Label) {
      page.drawText(col2Label, { x: colDatoX2, y, size: 9, font: regular, color: GRIS });
      page.drawText(col2Value ?? "", { x: colDatoX2 + 90, y, size: 9, font: bold, color: NEGRO });
    }
    y -= 14;
  };
  filaDato("Área:", area, "Solicitante:", solicitante);
  filaDato("Fecha de pedido:", fecha.toLocaleDateString("es-PE"), "Tipo de necesidad:", tipoNecesidad);
  filaDato("Fecha de necesidad:", fechaNecesidad.toLocaleDateString("es-PE"));
  if (justificacion) {
    page.drawText("Justificación:", { x: MARGEN_X, y, size: 9, font: regular, color: GRIS });
    page.drawText(truncar(justificacion, 85), { x: colDatoX, y, size: 9, font: bold, color: NEGRO });
    y -= 14;
  }
  y -= 10;

  dibujarEncabezadoTabla();

  for (const linea of lineas) {
    const lineasDescripcion = envolverTexto(linea.descripcion, regular, 8, columnas[1].ancho - 6);
    const alturaFila = 10 * lineasDescripcion.length + 2;
    if (y - alturaFila < MARGEN_INFERIOR) nuevaPagina();

    page.drawText(linea.codigo, { x: columnas[0].x + 3, y, size: 8, font: regular, color: NEGRO });
    for (let i = 0; i < lineasDescripcion.length; i++) {
      page.drawText(lineasDescripcion[i], { x: columnas[1].x + 3, y: y - i * 10, size: 8, font: regular, color: NEGRO });
    }
    page.drawText(`${linea.cantidad} ${linea.unidadMedida}`, { x: columnas[2].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(truncar(linea.centroCosto, 18), { x: columnas[3].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(truncar(linea.observaciones ?? "—", 28), { x: columnas[4].x + 3, y, size: 8, font: regular, color: NEGRO });
    y -= alturaFila;
    page.drawLine({
      start: { x: MARGEN_X, y: y + 4 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 4 },
      thickness: 0.4,
      color: GRIS_CLARO,
    });
    y -= 4;
  }

  if (!aprobado) dibujarMarcaDeAguaDraft(pdfDoc, bold);
  if (aprobado && aprobadoPor) dibujarFirmaAprobacion(page, aprobadoPor, regular, bold);

  return pdfDoc.save();
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}
