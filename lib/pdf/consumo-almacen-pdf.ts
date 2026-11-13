import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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

// Para un valor que puede ser largo (ej. "RETIRADO POR" con el DNI
// incluido) en una columna angosta: antes de recortarlo, se achica un
// poco la letra (hasta `tamanoMinimo`) para que se vea completo si cabe
// así — solo si ni achicado cabe, se recorta con "…" (ver truncarTexto).
function tamanoQueCabe(font: PDFFont, texto: string, tamanoPreferido: number, anchoMax: number, tamanoMinimo = 7): number {
  let size = tamanoPreferido;
  while (size > tamanoMinimo && font.widthOfTextAtSize(texto, size) > anchoMax) {
    size -= 0.5;
  }
  return size;
}

// Recorta a una sola línea que quepa en `anchoMax`, con "…" al final si
// hubo que cortar — usado donde dos textos van en la misma fila (columnas
// de la tabla, o pares de dato en la misma línea) y NO pueden invadir el
// espacio del vecino, por angosto que sea el valor real.
function truncarTexto(font: PDFFont, texto: string, size: number, anchoMax: number): string {
  if (font.widthOfTextAtSize(texto, size) <= anchoMax) return texto;
  let actual = texto;
  while (actual.length > 1 && font.widthOfTextAtSize(`${actual}…`, size) > anchoMax) {
    actual = actual.slice(0, -1);
  }
  return `${actual}…`;
}

const GRIS = rgb(0.45, 0.45, 0.45);
const GRIS_CLARO = rgb(0.85, 0.85, 0.85);
const NEGRO = rgb(0.1, 0.1, 0.1);

// No es para imprimirse en la etiqueta térmica del almacén: es solo para
// leerse en el celular (ver link del PDF en la bandeja de Consumos) — por
// eso el tamaño fijo es A6 (105mm x 148mm, en vez del "recibo angosto" de
// alto variable que tenía antes) y las fuentes son más grandes.
const MM_A_PT = 72 / 25.4;
const ANCHO_PAGINA = 105 * MM_A_PT;
const ALTO_PAGINA = 148 * MM_A_PT;
const MARGEN = 16;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

const TAM_CODIGO_HEADER = 13;
const TAM_TITULO = 14;
const TAM_LABEL = 9;
const TAM_VALOR = 11;
const TAM_SECCION = 9;
const TAM_TABLA_HEADER = 8;
const TAM_TABLA_DATA = 10;
const TAM_PIE = 8;

const GAP_LABEL_VALOR = 11;
const GAP_FILA_DATO = 15;
const GAP_TABLA_HEADER_LINEA = 11;
const GAP_LINEA_DATOS = 7;
const ALTO_FILA_ITEM = 15;

// Columnas de la tabla de productos (anchos en puntos, relativos a
// MARGEN) — no se muestra de qué almacén sale cada línea, eso lo decide
// quien atiende y no le aporta nada a quien retira/firma.
const COL_COD_X = 0;
const COL_PROD_X = 60;
const COL_LOTE_X = 170;
const COL_UM_X = 202;
const COL_CANT_X = 222;
const COL_COD_ANCHO = COL_PROD_X - COL_COD_X - 4;
const COL_PROD_ANCHO = COL_LOTE_X - COL_PROD_X - 4;
const COL_LOTE_ANCHO = COL_UM_X - COL_LOTE_X - 4;

export type LineaConsumoPdf = {
  codigo: string;
  descripcion: string;
  lote: string | null;
  cantidad: number;
  unidadMedida: string;
};

export async function generarConsumoAlmacenPdf({
  numero,
  fecha,
  fechaContabilizacion,
  horaRetiro,
  retiradoPor,
  registradoPor,
  vehiculoPlaca,
  horometroKilometraje,
  observaciones,
  lineas,
  firmaPngBytes,
}: {
  numero: string;
  fecha: Date;
  fechaContabilizacion: Date;
  horaRetiro: string | null;
  retiradoPor: string;
  registradoPor: string;
  vehiculoPlaca: string | null;
  horometroKilometraje: number | null;
  observaciones: string | null;
  lineas: LineaConsumoPdf[];
  firmaPngBytes: Uint8Array | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-rpb.jpg"));
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoAltura = 24;
  const logoAncho = (logo.width / logo.height) * logoAltura;

  // Pedida más pequeña que antes (ya no se imprime en la etiqueta, es solo
  // para leer en pantalla): tope de alto más bajo y no ocupa todo el ancho.
  let firma: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  let firmaAncho = 0;
  let firmaAlto = 0;
  if (firmaPngBytes) {
    firma = await pdfDoc.embedPng(firmaPngBytes);
    const anchoMaxFirma = ANCHO_UTIL * 0.55;
    const escalaAncho = anchoMaxFirma / firma.width;
    firmaAncho = firma.width * escalaAncho;
    firmaAlto = firma.height * escalaAncho;
    if (firmaAlto > 40) {
      const escalaAlto = 40 / firma.height;
      firmaAncho = firma.width * escalaAlto;
      firmaAlto = 40;
    }
  }

  const lineasObservaciones = observaciones ? envolverTexto(observaciones, regular, TAM_VALOR - 1, ANCHO_UTIL, 3) : [];

  // Encabezado de la tabla de productos (COD/PRODUCTO/LOTE/UM/CANT) + la
  // línea que lo separa de las filas de datos — se repite tal cual en cada
  // página nueva que haga falta por desbordamiento (ver el loop de abajo).
  function dibujarEncabezadoTabla(pagina: PDFPage, yInicial: number): number {
    let yy = yInicial;
    pagina.drawText("COD", { x: MARGEN + COL_COD_X, y: yy, size: TAM_TABLA_HEADER, font: bold, color: GRIS });
    pagina.drawText("PRODUCTO", { x: MARGEN + COL_PROD_X, y: yy, size: TAM_TABLA_HEADER, font: bold, color: GRIS });
    pagina.drawText("LOTE", { x: MARGEN + COL_LOTE_X, y: yy, size: TAM_TABLA_HEADER, font: bold, color: GRIS });
    pagina.drawText("UM", { x: MARGEN + COL_UM_X, y: yy, size: TAM_TABLA_HEADER, font: bold, color: GRIS });
    pagina.drawText("CANT", { x: MARGEN + COL_CANT_X, y: yy, size: TAM_TABLA_HEADER, font: bold, color: GRIS });
    yy -= GAP_TABLA_HEADER_LINEA;
    // La línea separa el encabezado de la primera fila de datos: no
    // comparte altura con ninguno de los dos, por eso va en su propio
    // escalón en vez de pegada al texto de arriba o de abajo.
    pagina.drawLine({ start: { x: MARGEN, y: yy }, end: { x: ANCHO_PAGINA - MARGEN, y: yy }, thickness: 0.5, color: GRIS_CLARO });
    yy -= GAP_LINEA_DATOS;
    return yy;
  }

  function dibujarFilaProducto(pagina: PDFPage, yFila: number, linea: LineaConsumoPdf) {
    pagina.drawText(truncarTexto(regular, linea.codigo, TAM_TABLA_DATA, COL_COD_ANCHO), {
      x: MARGEN + COL_COD_X,
      y: yFila,
      size: TAM_TABLA_DATA,
      font: regular,
      color: NEGRO,
    });
    pagina.drawText(truncarTexto(regular, linea.descripcion, TAM_TABLA_DATA, COL_PROD_ANCHO), {
      x: MARGEN + COL_PROD_X,
      y: yFila,
      size: TAM_TABLA_DATA,
      font: regular,
      color: NEGRO,
    });
    pagina.drawText(linea.lote ? truncarTexto(regular, linea.lote, TAM_TABLA_DATA, COL_LOTE_ANCHO) : "—", {
      x: MARGEN + COL_LOTE_X,
      y: yFila,
      size: TAM_TABLA_DATA,
      font: regular,
      color: NEGRO,
    });
    pagina.drawText(linea.unidadMedida, { x: MARGEN + COL_UM_X, y: yFila, size: TAM_TABLA_DATA, font: regular, color: NEGRO });
    const cantTexto = String(linea.cantidad);
    const cantAncho = regular.widthOfTextAtSize(cantTexto, TAM_TABLA_DATA);
    pagina.drawText(cantTexto, {
      x: ANCHO_PAGINA - MARGEN - cantAncho,
      y: yFila,
      size: TAM_TABLA_DATA,
      font: regular,
      color: NEGRO,
    });
  }

  let page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - MARGEN;

  page.drawImage(logo, { x: MARGEN, y: y - logoAltura, width: logoAncho, height: logoAltura });
  const codigoAncho = bold.widthOfTextAtSize(numero, TAM_CODIGO_HEADER);
  page.drawText(numero, {
    x: ANCHO_PAGINA - MARGEN - codigoAncho,
    y: y - (logoAltura + TAM_CODIGO_HEADER) / 2 + 1,
    size: TAM_CODIGO_HEADER,
    font: bold,
    color: NEGRO,
  });
  y -= logoAltura + 6;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO_PAGINA - MARGEN, y }, thickness: 0.75, color: NEGRO });
  y -= 18;

  page.drawText(`CONSUMO ${numero}`, { x: MARGEN, y, size: TAM_TITULO, font: bold, color: NEGRO });
  y -= 20;

  function filaDato(label: string, value: string) {
    page.drawText(label, { x: MARGEN, y, size: TAM_LABEL, font: bold, color: GRIS });
    y -= GAP_LABEL_VALOR;
    page.drawText(value, { x: MARGEN, y, size: TAM_VALOR, font: regular, color: NEGRO });
    y -= GAP_FILA_DATO;
  }
  // Dos pares label/valor en la misma fila (FECHA Y HORA / FECHA DE
  // CONTABILIZACIÓN, RETIRADO POR / REGISTRADO POR) — igual alto que
  // filaDato, solo que escribe en dos columnas en vez de una.
  function filaDatoDoble(label1: string, value1: string, label2: string, value2: string) {
    const colAncho = ANCHO_UTIL / 2;
    const anchoCol1 = colAncho - 6;
    const anchoCol2 = ANCHO_UTIL - colAncho - 2;
    page.drawText(truncarTexto(bold, label1, TAM_LABEL, anchoCol1), { x: MARGEN, y, size: TAM_LABEL, font: bold, color: GRIS });
    page.drawText(truncarTexto(bold, label2, TAM_LABEL, anchoCol2), {
      x: MARGEN + colAncho,
      y,
      size: TAM_LABEL,
      font: bold,
      color: GRIS,
    });
    y -= GAP_LABEL_VALOR;
    // Cada valor se recorta a lo que mide SU columna: un nombre largo (ej.
    // "RETIRADO POR" con DNI incluido) no puede invadir la columna vecina.
    const tamValor1 = tamanoQueCabe(regular, value1, TAM_VALOR, anchoCol1);
    const tamValor2 = tamanoQueCabe(regular, value2, TAM_VALOR, anchoCol2);
    page.drawText(truncarTexto(regular, value1, tamValor1, anchoCol1), {
      x: MARGEN,
      y,
      size: tamValor1,
      font: regular,
      color: NEGRO,
    });
    page.drawText(truncarTexto(regular, value2, tamValor2, anchoCol2), {
      x: MARGEN + colAncho,
      y,
      size: tamValor2,
      font: regular,
      color: NEGRO,
    });
    y -= GAP_FILA_DATO;
  }
  filaDatoDoble(
    "FECHA Y HORA",
    `${fecha.toLocaleDateString("es-PE")}${horaRetiro ? ` ${horaRetiro}` : ""}`,
    "FECHA DE CONTABILIZACIÓN",
    fechaContabilizacion.toLocaleDateString("es-PE")
  );
  filaDatoDoble("RETIRADO POR", retiradoPor, "REGISTRADO POR", registradoPor);
  if (vehiculoPlaca) filaDato("PLACA DEL VEHÍCULO", vehiculoPlaca);
  if (horometroKilometraje !== null) filaDato("HORÓMETRO / KILOMETRAJE", String(horometroKilometraje));

  if (lineasObservaciones.length > 0) {
    page.drawText("OBSERVACIONES", { x: MARGEN, y, size: TAM_SECCION, font: bold, color: GRIS });
    y -= GAP_LABEL_VALOR;
    for (const l of lineasObservaciones) {
      page.drawText(l, { x: MARGEN, y, size: TAM_VALOR - 1, font: regular, color: NEGRO });
      y -= GAP_LABEL_VALOR;
    }
    y -= 4;
  }

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO_PAGINA - MARGEN, y }, thickness: 0.5, color: GRIS_CLARO });
  y -= 16;

  // La firma va ANTES de la tabla de productos (pedido explícito) y más
  // chica que antes: ya no se imprime en la etiqueta térmica.
  page.drawText("FIRMA DE QUIEN RETIRA", { x: MARGEN, y, size: TAM_SECCION, font: bold, color: GRIS });
  y -= 12;
  if (firma) {
    page.drawImage(firma, { x: MARGEN, y: y - firmaAlto, width: firmaAncho, height: firmaAlto });
    y -= firmaAlto + 10;
  } else {
    page.drawText("(sin firma)", { x: MARGEN, y: y - 8, size: TAM_VALOR - 1, font: regular, color: GRIS });
    y -= 20;
  }

  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO_PAGINA - MARGEN, y }, thickness: 0.5, color: GRIS_CLARO });
  y -= 16;

  page.drawText("PRODUCTOS", { x: MARGEN, y, size: TAM_SECCION, font: bold, color: GRIS });
  y -= 12;
  y = dibujarEncabezadoTabla(page, y);

  // Si una fila no entra en lo que queda de la página, se abre una
  // hoja nueva en el mismo documento con SOLO el encabezado de la tabla y
  // las filas que faltan (sin repetir logo, datos ni firma).
  for (const linea of lineas) {
    if (y - ALTO_FILA_ITEM < MARGEN) {
      page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
      y = ALTO_PAGINA - MARGEN;
      y = dibujarEncabezadoTabla(page, y);
    }
    dibujarFilaProducto(page, y, linea);
    y -= ALTO_FILA_ITEM;
  }

  const altoNotaPie = 20;
  if (y - altoNotaPie < MARGEN) {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - MARGEN;
  }
  page.drawLine({ start: { x: MARGEN, y: y + 6 }, end: { x: ANCHO_PAGINA - MARGEN, y: y + 6 }, thickness: 0.5, color: GRIS_CLARO });
  page.drawText("Evidencia fotográfica del despacho adjunta en el sistema.", {
    x: MARGEN,
    y,
    size: TAM_PIE,
    font: regular,
    color: GRIS,
  });

  return pdfDoc.save();
}
