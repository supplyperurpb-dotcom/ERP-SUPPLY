import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dibujarMarcaDeAguaDraft } from "./marca-agua";
import { dibujarFirmaAprobacion } from "./firma-aprobacion";
import { IGV_TASA } from "@/lib/constants/compras";

const AZUL = rgb(0.11, 0.29, 0.63);
const GRIS = rgb(0.35, 0.35, 0.35);
const GRIS_CLARO = rgb(0.88, 0.88, 0.88);
const NEGRO = rgb(0.05, 0.05, 0.05);
const BLANCO = rgb(1, 1, 1);

const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const MARGEN_X = 36;
const ANCHO_TABLA = ANCHO_PAGINA - MARGEN_X * 2;
const MARGEN_INFERIOR = 110;

// Posiciones X de columnas de la tabla de ítems.
const COL = {
  item: MARGEN_X,
  codigo: MARGEN_X + 22,
  descripcion: MARGEN_X + 74,
  um: MARGEN_X + 246,
  cantidad: MARGEN_X + 272,
  unitario: MARGEN_X + 314,
  dct1: MARGEN_X + 371,
  dct2: MARGEN_X + 413,
  total: MARGEN_X + 455,
};

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
  fechaEntrega,
  condicionPago,
  lugarEntrega,
  observaciones,
  categoriaEsCompra,
  proveedor,
  rucProveedor,
  direccionProveedor,
  emailProveedor,
  telefonoProveedor,
  moneda,
  lineas,
  subtotal,
  igv,
  montoTotal,
  aprobado,
  aprobadoPor,
  usuarioSolped,
  usuarioCreacion,
}: {
  nombreDocumento: string;
  numero: string;
  fecha: Date;
  fechaEntrega: Date | null;
  condicionPago: string | null;
  lugarEntrega: string | null;
  observaciones: string | null;
  // Determina si se incluye el aviso de vida útil (pensado para productos
  // físicos) — no aplica a órdenes de servicio.
  categoriaEsCompra: boolean;
  proveedor: string;
  rucProveedor: string;
  direccionProveedor: string;
  emailProveedor: string;
  telefonoProveedor: string;
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
  usuarioSolped: string | null;
  usuarioCreacion: string | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-rpb.jpg"));
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoAltura = 44;
  const logoAncho = (logo.width / logo.height) * logoAltura;

  const moneyFmt = (n: number) =>
    new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  let page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - 40;

  // ---------------------------------------------------------------------
  // Encabezado: logo + RUC/razón social + centro emisor, y cajetín con el
  // número de la orden arriba a la derecha.
  // ---------------------------------------------------------------------
  page.drawImage(logo, { x: MARGEN_X, y: y - logoAltura + 8, width: logoAncho, height: logoAltura });

  const xDatosEmpresa = MARGEN_X + logoAncho + 14;
  page.drawText("20610390341", { x: xDatosEmpresa, y, size: 10, font: bold, color: NEGRO });
  y -= 13;
  page.drawText("REITER PERUVIAN BERRY S.A", { x: xDatosEmpresa, y, size: 11, font: bold, color: NEGRO });
  y -= 25;
  page.drawText("CENTRO", { x: MARGEN_X, y, size: 7, font: bold, color: GRIS });
  page.drawText("CAMPO CJ ICA", { x: MARGEN_X + 85, y, size: 7, font: regular, color: NEGRO });
  y -= 11;
  page.drawText("DIRECCIÓN CENTRO", { x: MARGEN_X, y, size: 7, font: bold, color: GRIS });
  page.drawText("SANTIAGO, ICA", { x: MARGEN_X + 85, y, size: 7, font: regular, color: NEGRO });

  const cajaAncho = 225;
  const cajaAlto = 32;
  const cajaX = ANCHO_PAGINA - MARGEN_X - cajaAncho;
  const cajaYTop = ALTO_PAGINA - 40;
  page.drawRectangle({
    x: cajaX,
    y: cajaYTop - cajaAlto,
    width: cajaAncho,
    height: cajaAlto,
    borderColor: NEGRO,
    borderWidth: 1,
    color: BLANCO,
  });
  page.drawLine({
    start: { x: cajaX + 140, y: cajaYTop },
    end: { x: cajaX + 140, y: cajaYTop - cajaAlto },
    thickness: 1,
    color: NEGRO,
  });
  const tituloCaja = `${nombreDocumento.toUpperCase()} N°`;
  page.drawText(tituloCaja, { x: cajaX + 8, y: cajaYTop - cajaAlto / 2 - 3, size: 8, font: bold, color: NEGRO });
  const anchoNumero = bold.widthOfTextAtSize(numero, 11);
  page.drawText(numero, {
    x: cajaX + 140 + (cajaAncho - 140 - anchoNumero) / 2,
    y: cajaYTop - cajaAlto / 2 - 4,
    size: 11,
    font: bold,
    color: NEGRO,
  });

  y -= 22;
  page.drawLine({ start: { x: MARGEN_X, y }, end: { x: ANCHO_PAGINA - MARGEN_X, y }, thickness: 1, color: AZUL });
  y -= 20;

  // ---------------------------------------------------------------------
  // Dos columnas: datos del proveedor (izquierda) y datos de la orden
  // (derecha).
  // ---------------------------------------------------------------------
  const yInicioBloques = y;
  const xEtiquetaIzq = MARGEN_X;
  const xValorIzq = MARGEN_X + 95;
  const xEtiquetaDer = MARGEN_X + 300;
  const xValorDer = xEtiquetaDer + 105;

  const filaIzq = (label: string, value: string) => {
    page.drawText(label, { x: xEtiquetaIzq, y, size: 8, font: bold, color: GRIS });
    page.drawText(value, { x: xValorIzq, y, size: 8, font: regular, color: NEGRO });
    y -= 13;
  };

  filaIzq("CÓDIGO (RUC):", rucProveedor || "—");
  filaIzq("RAZÓN SOCIAL:", truncar(proveedor, 42));
  const lineasDireccion = partirTexto(direccionProveedor || "—", 44);
  page.drawText("DIRECCIÓN:", { x: xEtiquetaIzq, y, size: 8, font: bold, color: GRIS });
  page.drawText(lineasDireccion[0] ?? "—", { x: xValorIzq, y, size: 8, font: regular, color: NEGRO });
  y -= 11;
  if (lineasDireccion[1]) {
    page.drawText(lineasDireccion[1], { x: xValorIzq, y, size: 8, font: regular, color: NEGRO });
    y -= 11;
  }
  y -= 2;
  filaIzq("EMAIL:", emailProveedor || "—");
  filaIzq("TELÉFONO:", telefonoProveedor || "—");

  let yDer = yInicioBloques;
  const filaDer = (label: string, value: string) => {
    page.drawText(label, { x: xEtiquetaDer, y: yDer, size: 8, font: bold, color: GRIS });
    page.drawText(value, { x: xValorDer, y: yDer, size: 8, font: regular, color: NEGRO });
    yDer -= 13;
  };
  filaDer("FECHA EMISIÓN:", fecha.toLocaleDateString("es-PE"));
  filaDer("FECHA ENTREGA:", fechaEntrega ? fechaEntrega.toLocaleDateString("es-PE") : "—");
  filaDer("CONDICIÓN DE PAGO:", condicionPago || "—");
  filaDer("MONEDA:", moneda);
  filaDer("ENTREGA:", lugarEntrega || "—");

  y = Math.min(y, yDer) - 14;

  // ---------------------------------------------------------------------
  // Tabla de ítems.
  // ---------------------------------------------------------------------
  function dibujarEncabezadoTabla() {
    page.drawRectangle({ x: MARGEN_X, y: y - 3, width: ANCHO_TABLA, height: 13, color: GRIS_CLARO });
    page.drawText("ITEM", { x: COL.item + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("CÓDIGO", { x: COL.codigo + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("DESCRIPCIÓN", { x: COL.descripcion + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("UM", { x: COL.um + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("CANTIDAD", { x: COL.cantidad + 2, y, size: 7, font: bold, color: NEGRO });
    const anchoValor = bold.widthOfTextAtSize("VALOR", 7);
    const centroValor = COL.unitario + (ANCHO_PAGINA - MARGEN_X - COL.unitario) / 2;
    page.drawText("VALOR", { x: centroValor - anchoValor / 2, y, size: 7, font: bold, color: NEGRO });
    y -= 10;
    page.drawRectangle({ x: COL.unitario, y: y - 3, width: ANCHO_PAGINA - MARGEN_X - COL.unitario, height: 11, color: GRIS_CLARO });
    page.drawText("UNITARIO", { x: COL.unitario + 2, y, size: 6, font: bold, color: NEGRO });
    page.drawText("% Dct 1", { x: COL.dct1 + 2, y, size: 6, font: bold, color: NEGRO });
    page.drawText("% Dct 2", { x: COL.dct2 + 2, y, size: 6, font: bold, color: NEGRO });
    page.drawText("TOTAL", { x: COL.total + 2, y, size: 6, font: bold, color: NEGRO });
    y -= 15;
  }

  function nuevaPagina() {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - 40;
    dibujarEncabezadoTabla();
  }

  dibujarEncabezadoTabla();

  lineas.forEach((linea, idx) => {
    if (y < MARGEN_INFERIOR) nuevaPagina();
    page.drawText(String(idx + 1), { x: COL.item + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.codigo, { x: COL.codigo + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(truncar(linea.descripcion, 40), { x: COL.descripcion + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.unidadMedida, { x: COL.um + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.cantidad.toFixed(2), { x: COL.cantidad + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(moneyFmt(linea.precioUnitario), { x: COL.unitario + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(moneyFmt(linea.subtotal), { x: COL.total + 2, y, size: 7, font: regular, color: NEGRO });
    y -= 10;
    page.drawLine({
      start: { x: MARGEN_X, y: y + 3 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 3 },
      thickness: 0.3,
      color: GRIS_CLARO,
    });
    y -= 5;
  });

  y -= 8;

  // ---------------------------------------------------------------------
  // Observaciones y aviso fijo de vida útil (solo para compras físicas).
  // ---------------------------------------------------------------------
  if (observaciones) {
    if (y < MARGEN_INFERIOR + 40) nuevaPagina();
    page.drawText("Observaciones", { x: MARGEN_X, y, size: 8, font: bold, color: NEGRO });
    y -= 12;
    for (const linea of partirTexto(observaciones, 105)) {
      page.drawText(linea, { x: MARGEN_X, y, size: 8, font: regular, color: NEGRO });
      y -= 11;
    }
    y -= 4;
  }

  if (categoriaEsCompra) {
    if (y < MARGEN_INFERIOR + 30) nuevaPagina();
    for (const linea of partirTexto(
      "No se aceptarán productos cuyo periodo de vida útil desde la fecha de recepción a la fecha de vencimiento sea menor a 18 meses.",
      100
    )) {
      page.drawText(linea, { x: MARGEN_X, y, size: 8, font: bold, color: NEGRO });
      y -= 11;
    }
    y -= 6;
  }

  // ---------------------------------------------------------------------
  // Totales.
  // ---------------------------------------------------------------------
  if (y < MARGEN_INFERIOR + 95) nuevaPagina();
  y -= 4;
  page.drawLine({
    start: { x: ANCHO_PAGINA - MARGEN_X - 230, y },
    end: { x: ANCHO_PAGINA - MARGEN_X, y },
    thickness: 0.5,
    color: GRIS,
  });
  y -= 15;

  const xLabelTotal = ANCHO_PAGINA - MARGEN_X - 230;
  const xMonedaTotal = ANCHO_PAGINA - MARGEN_X - 95;
  const filaTotal = (label: string, value: number, destacar = false) => {
    const font = destacar ? bold : regular;
    const size = destacar ? 9 : 8;
    page.drawText(label, { x: xLabelTotal, y, size, font: bold, color: destacar ? AZUL : NEGRO });
    page.drawText(moneda, { x: xMonedaTotal, y, size, font, color: destacar ? AZUL : NEGRO });
    const texto = moneyFmt(value);
    const ancho = font.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: ANCHO_PAGINA - MARGEN_X - ancho, y, size, font, color: destacar ? AZUL : NEGRO });
    y -= destacar ? 15 : 13;
  };
  filaTotal("SUB TOTAL", subtotal);
  filaTotal("DESCUENTOS", 0);
  filaTotal("VALOR VENTA", subtotal);
  filaTotal(`IMPUESTOS I.G.V. (${Math.round(IGV_TASA * 100)}%)`, igv);
  filaTotal("PRECIO TOTAL", montoTotal, true);
  y -= 16;

  // ---------------------------------------------------------------------
  // Pie: usuarios y referencias internas.
  // ---------------------------------------------------------------------
  if (y < MARGEN_INFERIOR - 40) nuevaPagina();
  const filaPie = (label: string, value: string) => {
    page.drawText(label, { x: MARGEN_X, y, size: 7, font: bold, color: GRIS });
    page.drawText(value, { x: MARGEN_X + 125, y, size: 7, font: regular, color: NEGRO });
    y -= 11;
  };
  filaPie("USUARIO SOLPED:", usuarioSolped || "—");
  filaPie("USUARIO CREACIÓN OC:", usuarioCreacion || "—");
  filaPie("USUARIO MODIFICACIÓN OC:", "—");
  filaPie("REQUISICIÓN:", "—");
  filaPie("PEP:", "—");

  if (!aprobado) dibujarMarcaDeAguaDraft(pdfDoc, bold);
  if (aprobado && aprobadoPor) dibujarFirmaAprobacion(page, aprobadoPor, regular, bold);

  return pdfDoc.save();
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// Parte un texto largo en líneas de como mucho `max` caracteres, cortando
// por espacios para no partir palabras a la mitad.
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
