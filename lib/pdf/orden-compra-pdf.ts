import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { dibujarMarcaDeAgua } from "./marca-agua";
import { IGV_TASA } from "@/lib/constants/compras";

const GRIS = rgb(0.35, 0.35, 0.35);
const GRIS_CLARO = rgb(0.88, 0.88, 0.88);
const NEGRO = rgb(0.05, 0.05, 0.05);

const ANCHO_PAGINA = 595.28; // A4 en puntos
const ALTO_PAGINA = 841.89;
const MARGEN_X = 36;
const ANCHO_TABLA = ANCHO_PAGINA - MARGEN_X * 2;
const MARGEN_INFERIOR = 110;

// Posiciones X de columnas de la tabla de ítems.
const COL = {
  item: MARGEN_X,
  codigo: MARGEN_X + 24,
  descripcion: MARGEN_X + 84,
  um: MARGEN_X + 306,
  cantidad: MARGEN_X + 334,
  unitario: MARGEN_X + 396,
  subtotal: MARGEN_X + 458,
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
  tipoOrdenLabel,
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
  anulado,
  aprobadoPorCodigo,
  usuarioSolped,
  usuarioCreacion,
  solpedAprobadoPor,
}: {
  nombreDocumento: string;
  numero: string;
  fecha: Date;
  // "Estándar" o "Abierta" (ver TIPOS_ORDEN en lib/constants/compras.ts) —
  // reemplaza al campo Hora, que ya no se muestra (pedido explícito,
  // 2026-11-26).
  tipoOrdenLabel: string;
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
  // Si quedó ANULADA, se marca con esa marca de agua en lugar de BORRADOR
  // (son excluyentes: una orden anulada no está aprobada).
  anulado?: boolean;
  // Código de quien aprobó (ver codigoAprobador en lib/utils.ts); se
  // muestra en la trazabilidad del pie solo si aprobado=true.
  aprobadoPorCodigo?: string | null;
  usuarioSolped: string | null;
  usuarioCreacion: string | null;
  // Nombre de quien aprobó la(s) solicitud(es) de pedido de origen.
  solpedAprobadoPor: string | null;
}): Promise<Uint8Array> {
  // Pedido explícito: todo el texto del PDF sale en mayúscula, aunque el
  // dato guardado no lo esté (cubre también registros viejos, de antes de
  // que el resto del sistema empezara a guardar todo en mayúscula).
  condicionPago = condicionPago?.toUpperCase() ?? null;
  lugarEntrega = lugarEntrega?.toUpperCase() ?? null;
  observaciones = observaciones?.toUpperCase() ?? null;
  proveedor = proveedor.toUpperCase();
  direccionProveedor = direccionProveedor.toUpperCase();
  emailProveedor = emailProveedor.toUpperCase();
  telefonoProveedor = telefonoProveedor.toUpperCase();
  usuarioSolped = usuarioSolped?.toUpperCase() ?? null;
  usuarioCreacion = usuarioCreacion?.toUpperCase() ?? null;
  solpedAprobadoPor = solpedAprobadoPor?.toUpperCase() ?? null;
  tipoOrdenLabel = tipoOrdenLabel.toUpperCase();
  lineas = lineas.map((l) => ({
    ...l,
    codigo: l.codigo.toUpperCase(),
    descripcion: l.descripcion.toUpperCase(),
    unidadMedida: l.unidadMedida.toUpperCase(),
  }));

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

  // Dibuja un texto alineado a la derecha de `xDerecha` (p. ej. P. Unitario
  // y Subtotal de la tabla de ítems, que son columnas numéricas).
  function drawTextRight(texto: string, xDerecha: number, yTexto: number, size: number, font: PDFFont) {
    const ancho = font.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: xDerecha - ancho, y: yTexto, size, font, color: NEGRO });
  }

  // ---------------------------------------------------------------------
  // Encabezado: logo con la razón social y el RUC debajo (no al lado), y
  // cajetín con el número de la orden arriba a la derecha.
  // ---------------------------------------------------------------------
  const yLogoSuperior = y;
  page.drawImage(logo, { x: MARGEN_X, y: y - logoAltura + 8, width: logoAncho, height: logoAltura });

  // Alineado a la derecha, a la misma altura que el logo, con el número
  // pegado justo después de la etiqueta (sin ancho fijo adivinado).
  const sizeCaja = 11;
  const tituloCaja = `${nombreDocumento.toUpperCase()} N°`;
  const anchoNumero = bold.widthOfTextAtSize(numero, sizeCaja);
  const xNumero = ANCHO_PAGINA - MARGEN_X - anchoNumero;
  const anchoTitulo = bold.widthOfTextAtSize(`${tituloCaja} `, sizeCaja);
  page.drawText(tituloCaja, { x: xNumero - anchoTitulo, y, size: sizeCaja, font: bold, color: NEGRO });
  page.drawText(numero, { x: xNumero, y, size: sizeCaja, font: bold, color: NEGRO });

  let yEmpresa = yLogoSuperior - logoAltura + 8 - 12;
  page.drawText("REITER PERUVIAN BERRY S.A", { x: MARGEN_X, y: yEmpresa, size: 10, font: bold, color: NEGRO });
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

  // ---------------------------------------------------------------------
  // Dos columnas: datos del proveedor (izquierda) y datos de la orden
  // (derecha).
  // ---------------------------------------------------------------------
  const yInicioBloques = y;
  const xEtiquetaIzq = MARGEN_X;
  const xValorIzq = MARGEN_X + 95;
  const xEtiquetaDer = MARGEN_X + 300;
  const xValorDer = xEtiquetaDer + 105;
  // Ancho disponible de cada columna antes de toparse con la etiqueta de
  // al lado (izquierda) o el margen derecho de la hoja — el valor se
  // envuelve por ancho real en puntos (no por cantidad de caracteres), así
  // nunca se superpone con la columna vecina sin importar qué tan largo
  // sea el texto (p. ej. una razón social o dirección larga).
  const anchoValorIzq = xEtiquetaDer - xValorIzq - 10;
  const anchoValorDer = ANCHO_PAGINA - MARGEN_X - xValorDer;
  const ALTO_LINEA = 11;

  // Dibuja una fila "etiqueta: valor", envolviendo el valor en tantas
  // líneas como haga falta, y devuelve cuánto bajó `y` (para que, si el
  // valor ocupó más de una línea, el siguiente campo —de esta columna o
  // de la otra— también baje y no quede superpuesto).
  const dibujarFila = (x: number, xValor: number, anchoMax: number, label: string, value: string, yFila: number): number => {
    const lineas = envolverTextoPx(value, regular, 8, anchoMax);
    page.drawText(label, { x, y: yFila, size: 8, font: bold, color: GRIS });
    let yLinea = yFila;
    for (const linea of lineas.length > 0 ? lineas : ["—"]) {
      page.drawText(linea, { x: xValor, y: yLinea, size: 8, font: regular, color: NEGRO });
      yLinea -= ALTO_LINEA;
    }
    return yFila - Math.max(lineas.length, 1) * ALTO_LINEA - 2;
  };

  y = dibujarFila(xEtiquetaIzq, xValorIzq, anchoValorIzq, "RUC:", rucProveedor || "—", y);
  y = dibujarFila(xEtiquetaIzq, xValorIzq, anchoValorIzq, "RAZÓN SOCIAL:", proveedor, y);
  y = dibujarFila(xEtiquetaIzq, xValorIzq, anchoValorIzq, "DIRECCIÓN:", direccionProveedor || "—", y);
  y = dibujarFila(xEtiquetaIzq, xValorIzq, anchoValorIzq, "EMAIL:", emailProveedor || "—", y);
  y = dibujarFila(xEtiquetaIzq, xValorIzq, anchoValorIzq, "TELÉFONO:", telefonoProveedor || "—", y);

  let yDer = yInicioBloques;
  yDer = dibujarFila(xEtiquetaDer, xValorDer, anchoValorDer, "FECHA EMISIÓN:", fecha.toLocaleDateString("es-PE"), yDer);
  yDer = dibujarFila(xEtiquetaDer, xValorDer, anchoValorDer, "TIPO DE ORDEN:", tipoOrdenLabel, yDer);
  yDer = dibujarFila(
    xEtiquetaDer,
    xValorDer,
    anchoValorDer,
    "FECHA ENTREGA:",
    fechaEntrega ? fechaEntrega.toLocaleDateString("es-PE") : "—",
    yDer
  );
  yDer = dibujarFila(xEtiquetaDer, xValorDer, anchoValorDer, "CONDICIÓN DE PAGO:", condicionPago || "—", yDer);
  yDer = dibujarFila(xEtiquetaDer, xValorDer, anchoValorDer, "MONEDA:", moneda, yDer);
  yDer = dibujarFila(xEtiquetaDer, xValorDer, anchoValorDer, "ENTREGA:", lugarEntrega || "—", yDer);

  y = Math.min(y, yDer) - 12;

  // ---------------------------------------------------------------------
  // Tabla de ítems.
  // ---------------------------------------------------------------------
  function dibujarEncabezadoTabla() {
    page.drawLine({
      start: { x: MARGEN_X, y: y + 10 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y + 10 },
      thickness: 0.75,
      color: NEGRO,
    });
    page.drawLine({
      start: { x: MARGEN_X, y: y - 3 },
      end: { x: ANCHO_PAGINA - MARGEN_X, y: y - 3 },
      thickness: 0.75,
      color: NEGRO,
    });
    page.drawText("ITEM", { x: COL.item + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("CÓDIGO", { x: COL.codigo + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("DESCRIPCIÓN", { x: COL.descripcion + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("UM", { x: COL.um + 2, y, size: 7, font: bold, color: NEGRO });
    page.drawText("CANTIDAD", { x: COL.cantidad + 2, y, size: 7, font: bold, color: NEGRO });
    drawTextRight("P. UNITARIO", COL.subtotal - 4, y, 7, bold);
    drawTextRight("SUBTOTAL", ANCHO_PAGINA - MARGEN_X - 2, y, 7, bold);
    y -= 17;
  }

  function nuevaPagina() {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - 40;
    dibujarEncabezadoTabla();
  }

  dibujarEncabezadoTabla();

  lineas.forEach((linea, idx) => {
    // La descripción puede traer el detalle de un servicio (más larga que
    // un nombre de producto), así que se envuelve en varias líneas en vez
    // de truncarse a una sola.
    const lineasDescripcion = partirTexto(linea.descripcion, 48).slice(0, 4);
    const alturaFila = 9 * lineasDescripcion.length + 1;
    if (y - alturaFila < MARGEN_INFERIOR) nuevaPagina();
    page.drawText(String(idx + 1), { x: COL.item + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.codigo, { x: COL.codigo + 2, y, size: 7, font: regular, color: NEGRO });
    for (let i = 0; i < lineasDescripcion.length; i++) {
      page.drawText(lineasDescripcion[i], { x: COL.descripcion + 2, y: y - i * 9, size: 7, font: regular, color: NEGRO });
    }
    page.drawText(linea.unidadMedida, { x: COL.um + 2, y, size: 7, font: regular, color: NEGRO });
    page.drawText(linea.cantidad.toFixed(2), { x: COL.cantidad + 2, y, size: 7, font: regular, color: NEGRO });
    drawTextRight(moneyFmt(linea.precioUnitario), COL.subtotal - 4, y, 7, regular);
    drawTextRight(moneyFmt(linea.subtotal), ANCHO_PAGINA - MARGEN_X - 2, y, 7, regular);
    y -= alturaFila;
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
  // Comentario.
  // ---------------------------------------------------------------------
  if (observaciones) {
    if (y < MARGEN_INFERIOR + 40) nuevaPagina();
    page.drawText("Comentario", { x: MARGEN_X, y, size: 8, font: bold, color: NEGRO });
    y -= 12;
    for (const linea of partirTexto(observaciones, 105)) {
      page.drawText(linea, { x: MARGEN_X, y, size: 8, font: regular, color: NEGRO });
      y -= 11;
    }
    y -= 4;
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
    page.drawText(label, { x: xLabelTotal, y, size, font: bold, color: NEGRO });
    page.drawText(moneda, { x: xMonedaTotal, y, size, font, color: NEGRO });
    const texto = moneyFmt(value);
    const ancho = font.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: ANCHO_PAGINA - MARGEN_X - ancho, y, size, font, color: NEGRO });
    y -= destacar ? 15 : 13;
  };
  filaTotal("SUB TOTAL", subtotal);
  filaTotal(`IMPUESTOS I.G.V. (${Math.round(IGV_TASA * 100)}%)`, igv);
  filaTotal("TOTAL", montoTotal, true);
  y -= 16;

  // ---------------------------------------------------------------------
  // Pie: usuarios y referencias internas — pegado a continuación del
  // total (no al pie de la página; ver condiciones de facturación más
  // abajo, que sí van ancladas al pie).
  // ---------------------------------------------------------------------
  if (y < MARGEN_INFERIOR - 40) nuevaPagina();
  const filaPie = (label: string, value: string) => {
    page.drawText(label, { x: MARGEN_X, y, size: 7, font: bold, color: GRIS });
    page.drawText(value, { x: MARGEN_X + 125, y, size: 7, font: regular, color: NEGRO });
    y -= 11;
  };
  filaPie("SOLICITADO POR:", usuarioSolped || "—");
  filaPie("SOLICITUD APROBADA POR:", solpedAprobadoPor || "—");
  filaPie(`${categoriaEsCompra ? "OC" : "OS"} GENERADA POR:`, usuarioCreacion || "—");
  if (aprobado && aprobadoPorCodigo) {
    filaPie(`${categoriaEsCompra ? "OC" : "OS"} APROBADA POR:`, aprobadoPorCodigo);
  }

  // ---------------------------------------------------------------------
  // Condiciones de facturación y recepción (solo compras físicas) —
  // pedido explícito: SIEMPRE pegadas al pie de la página en la que
  // terminen cayendo, sin importar cuánto contenido haya arriba. Se mide
  // su altura exacta primero (dibujar=false) y luego se dibuja ya
  // sabiendo desde dónde arrancar para que la última línea quede a
  // PIE_MARGEN del borde inferior.
  // ---------------------------------------------------------------------
  // Términos y condiciones: hoja completa aparte (pedido explícito,
  // 2026-11-26), igual para OC y OS — siempre en la hoja siguiente a
  // donde termina el detalle de arriba, nunca compartiendo página con él.
  // Texto tomado tal cual de una OC/OS real ya emitida en Word (ver
  // "CONDICIONES COMERCIALES CONTRATADAS" en los formatos usados hasta
  // ahora), limpiando solo los espacios sueltos que trae ese Word.
  // ---------------------------------------------------------------------
  page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  y = ALTO_PAGINA - 40;

  function nuevaPaginaTerminos() {
    page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - 40;
  }

  function lineaTerminos(texto: string, x: number, font: PDFFont, size: number) {
    if (y < MARGEN_INFERIOR) nuevaPaginaTerminos();
    page.drawText(texto, { x, y, size, font, color: NEGRO });
    y -= size + 3;
  }

  function parrafoTerminos(texto: string) {
    for (const l of envolverTextoPx(texto, regular, 8, ANCHO_TABLA)) {
      lineaTerminos(l, MARGEN_X, regular, 8);
    }
  }

  function tituloSeccion(texto: string) {
    y -= 6;
    lineaTerminos(texto, MARGEN_X, bold, 9);
  }

  function bulletTerminos(texto: string) {
    const lineasTexto = envolverTextoPx(texto, regular, 8, ANCHO_TABLA - 24);
    lineasTexto.forEach((l, i) => {
      if (i === 0) {
        if (y < MARGEN_INFERIOR) nuevaPaginaTerminos();
        page.drawText("•", { x: MARGEN_X + 6, y, size: 8, font: regular, color: NEGRO });
      }
      lineaTerminos(l, MARGEN_X + 18, regular, 8);
    });
  }

  lineaTerminos("CONDICIONES COMERCIALES CONTRATADAS", MARGEN_X, bold, 12);
  y -= 6;

  tituloSeccion("FECHA DE VENCIMIENTO DE PRODUCTOS");
  parrafoTerminos(
    "Las fechas de fabricación/producción y vencimiento deben ser debidamente rotuladas en los productos. No se aceptarán productos próximos a vencer y como mínimo estos deberán tener un periodo de vida útil de 18 meses desde la fecha de recepción. En caso este periodo sea menor, REITER PERUVIAN BERRY S.A. se reserva el derecho de rechazar la entrega y el proveedor deberá reemplazar el producto."
  );

  tituloSeccion("GARANTÍA");
  parrafoTerminos(
    "Los productos deberán estar adecuadamente embalados y/o rotulados, de acuerdo con sus características. Cualquier avería y/o reparación de los mismos durante el transporte, o atribuible a un mal embalaje y/o rotulado, es responsabilidad del fabricante. Adicionalmente, el proveedor deberá garantizar el material adquirido contra todo defecto de fabricación y/o vicios ocultos."
  );

  tituloSeccion("DOCUMENTACIÓN");
  parrafoTerminos(
    "Los comprobantes de pago deben ser electrónicos y enviados a facturas.peru@berry.net con copia a su comprador. Deben incluir, por cada documento presentado:"
  );
  bulletTerminos("Productos: Factura, Guía de Remisión y Orden de Compra debidamente firmada.");
  bulletTerminos(
    "Servicio: Factura, Acta de conformidad / informe / resultado de análisis (firmado por el encargado del área) y Orden de Servicio debidamente firmada."
  );

  tituloSeccion("ACEPTACIÓN / CANCELACIÓN DE LA O/C Y O/S");
  parrafoTerminos(
    "En el supuesto caso de no existir conformidad con las condiciones detalladas de la presente Orden de Compra/Servicio, su rechazo total deberá ser comunicado por escrito dentro de las 24 horas de recibida la misma. Caso contrario, la presente Orden de Compra/Servicio se considerará tácitamente aceptada en todos sus términos y el cumplimiento de la misma será plenamente exigible. Queda establecido que, en caso el proveedor incumpla parcial o totalmente con algunas condiciones, REITER PERUVIAN BERRY S.A. se reserva el derecho de cancelarla, parcial o totalmente, sin que esto represente reclamo o reconocimiento alguno por parte del proveedor."
  );

  tituloSeccion("NORMAS DE SEGURIDAD, SALUD OCUPACIONAL Y MEDIO AMBIENTE");
  parrafoTerminos(
    "Además de las normas legales vigentes referidas a Seguridad y Salud en el Trabajo, tales como la Ley N° 29783, su Reglamento, el D.S. N° 005-2012-TR y demás normas conexas, así como medioambientales, EL PROVEEDOR se compromete a respetar y hacer cumplir a su personal los lineamientos de Seguridad, Salud Ocupacional y Medio Ambiente establecidos por REITER PERUVIAN BERRY S.A. para el cabal desempeño de sus funciones, independientemente de si se llegase a formalizar un contrato de prestación de servicios, manifestando que el presente documento tiene plena vigencia y eficacia para los fines que se persiguen, siendo plenamente ejecutable ante las instancias administrativas y/o judiciales correspondientes."
  );
  y -= 3;
  parrafoTerminos(
    "Para el efectivo cumplimiento de lo señalado en el párrafo precedente, REITER PERUVIAN BERRY S.A. brindará, a solicitud del proveedor, la inducción, formatos y documentación que resulten necesarios a través de su área de Seguridad y Salud Ocupacional."
  );
  y -= 3;
  parrafoTerminos(
    "El incumplimiento, así como el cumplimiento parcial, tardío y/o defectuoso de lo prescrito en la presente cláusula, generará la resolución inmediata del vínculo entre las partes, dando pase a la indemnización por daños y perjuicios a favor de REITER PERUVIAN BERRY S.A. y/o terceros que pudieran haberse visto afectados con el actuar negligente de El Proveedor, que corresponda."
  );
  y -= 3;
  parrafoTerminos(
    "Para todos los efectos de este documento, las partes se someten a la competencia de la Corte Superior de Justicia de Ica o Lima, renunciando a la competencia que pudiera corresponder a sus respectivos domicilios."
  );

  tituloSeccion("REQUISITOS BÁSICOS DE SEGURIDAD PARA VISITA A PLANTA Y/O CAMPO");
  bulletTerminos("Contar con SCTR.");
  bulletTerminos("Contar con EPPs completos.");
  bulletTerminos("Conocer el manejo de residuos sólidos.");
  bulletTerminos("Gestión adecuada de recursos (agua, energía, combustibles, etc.).");

  if (anulado) dibujarMarcaDeAgua(pdfDoc, bold, "ANULADA");
  else if (!aprobado) dibujarMarcaDeAgua(pdfDoc, bold);

  return pdfDoc.save();
}

// Como partirTexto, pero envuelve por ancho real en puntos (no por cantidad
// de caracteres), para aprovechar todo el margen disponible de la hoja.
function envolverTextoPx(texto: string, font: PDFFont, size: number, anchoMax: number): string[] {
  const palabras = texto.split(" ");
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
  return lineas;
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
