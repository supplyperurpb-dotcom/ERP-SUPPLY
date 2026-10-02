import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dibujarMarcaDeAguaDraft } from "./marca-agua";
import { dibujarFirmaAprobacion } from "./firma-aprobacion";

const AZUL = rgb(0.11, 0.29, 0.63);
const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.85, 0.85, 0.85);
const NEGRO = rgb(0.1, 0.1, 0.1);

const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const MARGEN_X = 40;
const MARGEN_INFERIOR = 70;

export type LineaOrdenCompraPdf = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  precioUnitario: number;
  gravado: boolean;
  subtotal: number;
  centroCosto: string;
};

export async function generarOrdenCompraPdf({
  nombreDocumento,
  numero,
  fecha,
  proveedor,
  rucProveedor,
  moneda,
  lineas,
  subtotal,
  igv,
  montoTotal,
  aprobado,
  aprobadoPor,
}: {
  nombreDocumento: string;
  numero: string;
  fecha: Date;
  proveedor: string;
  rucProveedor: string;
  moneda: string;
  lineas: LineaOrdenCompraPdf[];
  subtotal: number;
  igv: number;
  montoTotal: number;
  // Mientras no esté aprobada (pendiente de VB, rechazada, borrador), se
  // marca el PDF como borrador. Desaparece en cuanto queda APROBADO.
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

  const moneyFmt = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(n);

  let page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - 50;

  function nuevaPagina() {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - 50;
    dibujarEncabezadoTabla();
  }

  page.drawImage(logo, { x: MARGEN_X, y: y - logoAltura + 8, width: logoAncho, height: logoAltura });
  page.drawText("REITER PERUVIAN BERRY SA", { x: MARGEN_X + logoAncho + 12, y, size: 12, font: bold, color: AZUL });
  y -= 14;
  page.drawText("Ica, Perú — Documento interno (no válido como comprobante SUNAT)", {
    x: MARGEN_X + logoAncho + 12,
    y,
    size: 7,
    font: regular,
    color: GRIS,
  });
  y -= 20;
  page.drawLine({ start: { x: MARGEN_X, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 1, color: AZUL });
  y -= 26;

  page.drawText(`${nombreDocumento.toUpperCase()} ${numero}`, { x: MARGEN_X, y, size: 15, font: bold, color: NEGRO });
  y -= 22;

  const colDatoX = MARGEN_X + 90;
  const filaDato = (label: string, value: string) => {
    page.drawText(label, { x: MARGEN_X, y, size: 9, font: regular, color: GRIS });
    page.drawText(value, { x: colDatoX, y, size: 9, font: bold, color: NEGRO });
    y -= 14;
  };
  filaDato("Proveedor:", proveedor);
  if (rucProveedor) filaDato("RUC:", rucProveedor);
  filaDato("Fecha:", fecha.toLocaleDateString("es-PE"));
  filaDato("Moneda:", moneda);
  y -= 10;

  const columnas = [
    { titulo: "Código", x: MARGEN_X, ancho: 60 },
    { titulo: "Producto", x: MARGEN_X + 60, ancho: 150 },
    { titulo: "Centro costo", x: MARGEN_X + 210, ancho: 80 },
    { titulo: "Cant.", x: MARGEN_X + 290, ancho: 45 },
    { titulo: "P. Unit.", x: MARGEN_X + 335, ancho: 55 },
    { titulo: "Grav.", x: MARGEN_X + 390, ancho: 30 },
    { titulo: "Subtotal", x: MARGEN_X + 420, ancho: 95 },
  ];

  function dibujarEncabezadoTabla() {
    page.drawRectangle({
      x: MARGEN_X,
      y: y - 4,
      width: ANCHO_PAGINA - MARGEN_X * 2,
      height: 16,
      color: GRIS_CLARO,
    });
    for (const col of columnas) {
      page.drawText(col.titulo, { x: col.x + 3, y, size: 8, font: bold, color: NEGRO });
    }
    y -= 20;
  }

  dibujarEncabezadoTabla();

  for (const linea of lineas) {
    if (y < MARGEN_INFERIOR) nuevaPagina();
    page.drawText(linea.codigo, { x: columnas[0].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(truncar(linea.descripcion, 32), { x: columnas[1].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(truncar(linea.centroCosto, 16), { x: columnas[2].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(`${linea.cantidad} ${linea.unidadMedida}`, { x: columnas[3].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(moneyFmt(linea.precioUnitario), { x: columnas[4].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(linea.gravado ? "Sí" : "No", { x: columnas[5].x + 3, y, size: 8, font: regular, color: NEGRO });
    page.drawText(moneyFmt(linea.subtotal), { x: columnas[6].x + 3, y, size: 8, font: regular, color: NEGRO });
    y -= 12;
    page.drawLine({
      start: { x: MARGEN_X, y: y + 4 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 4 },
      thickness: 0.4,
      color: GRIS_CLARO,
    });
    y -= 4;
  }

  if (y < MARGEN_INFERIOR + 50) nuevaPagina();
  y -= 10;
  page.drawLine({ start: { x: MARGEN_X + 300, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 0.5, color: GRIS });
  y -= 16;

  const filaTotal = (label: string, value: string, destacar = false) => {
    page.drawText(label, { x: MARGEN_X + 300, y, size: destacar ? 10 : 9, font: destacar ? bold : regular, color: destacar ? AZUL : GRIS });
    page.drawText(value, { x: ANCHO_PAGINA - MARGEN_X - 95, y, size: destacar ? 11 : 9, font: bold, color: destacar ? AZUL : NEGRO });
    y -= destacar ? 16 : 14;
  };
  filaTotal("Subtotal:", moneyFmt(subtotal));
  filaTotal("IGV:", moneyFmt(igv));
  filaTotal("TOTAL:", moneyFmt(montoTotal), true);

  if (!aprobado) dibujarMarcaDeAguaDraft(pdfDoc, bold);
  if (aprobado && aprobadoPor) dibujarFirmaAprobacion(page, aprobadoPor, regular, bold);

  return pdfDoc.save();
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}
