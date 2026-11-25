import * as XLSX from "xlsx";

// Parser puro (no toca Prisma/Supabase) de la hoja "Facturación" del Excel
// de facturación de exportación, para la migración histórica a
// HistoricalBilling (ver plan "COMEX: Base de datos centralizada de
// Exportaciones"). A diferencia de scripts/importar-facturacion-exportacion.ts
// (que solo guarda 21 columnas para el dashboard actual, y al que NO se
// toca), este parser preserva las 130 columnas originales por fila en
// datosOriginales, y detecta errores de fórmula (#DIV/0!, #VALUE!) leyendo
// las celdas crudas en vez de confiar en sheet_to_json (que convierte las
// celdas de error en null sin avisar).
//
// Los nombres/criterios de las ~21 columnas tipadas son A PROPÓSITO
// idénticos a los de scripts/importar-facturacion-exportacion.ts (mismas
// normalizaciones: destinationCountry en mayúsculas, destino solo
// TERMINAL MARKET/NON FRESH, mismo filtro de fila válida) para que el
// subconjunto tipado sea comparable 1:1 con facturacion_exportacion en la
// Conciliación Excel vs Supabase.

const MAX_FILAS_BUSQUEDA_ENCABEZADO = 20;

const COLUMNAS_TIPADAS = {
  dispatchDate: "DISPATCH DATE",
  dispWeek: "DISP. WEEK",
  customer: "CUSTOMER",
  market: "MARKET",
  originPort: "ORIGIN AIRPORT/ PORT",
  destinationCountry: "DESTINATION COUNTRY",
  format: "FORMAT",
  po: "PO",
  transportMode: "EXPORTS",
  weekEta: "WEEK ETA",
  weekAta: "WEE ATA",
  statusEmbarque: "STATUS EMBARQUE",
  settlementStatus: "STATUS",
  variety: "VARIETY",
  type: "TYPE",
  label: "LABEL",
  destino: "Destino",
  totalFob: "USD TOTAL FOB",
  invoicedAmount: "INVOICED AMOUNT - 1 (CIF)",
  cifLiquidatedTariffs: "CIF Liquidated (Tariffs)",
  netWeight: "NET WEIGHT",
  netKilosLiquidated: "Net Kilos Liquidated",
} as const;

export type FilaHistoricaParseada = {
  sourceRowNumber: number;
  dispatchDate: Date;
  dispWeek: number;
  customer: string;
  market: string;
  originPort: string;
  destinationCountry: string;
  format: string;
  po: string;
  transportMode: string;
  weekEta: number | null;
  weekAta: number | null;
  statusEmbarque: string;
  settlementStatus: string;
  variety: string;
  type: string;
  label: string;
  destino: string | null;
  totalFob: number;
  invoicedAmount: number;
  cifLiquidatedTariffs: number;
  netWeight: number;
  netKilosLiquidated: number;
  datosOriginales: Record<string, string | number | boolean | null>;
  camposConError: string[];
};

export type ResultadoParseFacturacionHistorica = {
  nombreHoja: string;
  totalFilasLeidas: number;
  filas: FilaHistoricaParseada[];
  errores: string[];
};

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarClave(valor: unknown): string {
  return normalizar(valor).toLowerCase();
}

const DESTINOS_VALIDOS = new Set(["TERMINAL MARKET", "NON FRESH"]);
function aDestino(valor: unknown): string | null {
  const texto = normalizar(valor).toUpperCase();
  return DESTINOS_VALIDOS.has(texto) ? texto : null;
}

function aNumero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const n = Number(valor.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function aEnteroONulo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

// Valor crudo de una celda, preservando su tipo real (Date para fechas,
// number, string) — usado para construir el subconjunto tipado.
function valorCrudo(ws: XLSX.WorkSheet, addr: string): unknown {
  const cell = ws[addr];
  if (!cell || cell.t === "e") return null;
  return cell.v ?? null;
}

// Valor "seguro para JSON" de una celda — usado para datosOriginales.
// Las celdas de error de fórmula se guardan con su texto tal cual
// (#DIV/0!, #VALUE!), NUNCA como 0 ni como null silencioso.
function valorJson(ws: XLSX.WorkSheet, addr: string): string | number | boolean | null {
  const cell = ws[addr];
  if (!cell) return null;
  if (cell.t === "e") return String(cell.w ?? "#ERROR!");
  if (cell.t === "d") return (cell.v as Date).toISOString();
  if (cell.t === "n" || cell.t === "b") return cell.v as number | boolean;
  return String(cell.v ?? "");
}

export function parsearFacturacionHistoricaExcel(buffer: Buffer): ResultadoParseFacturacionHistorica {
  const libro = XLSX.read(buffer, { cellDates: true, type: "buffer" });
  const nombreHoja = libro.SheetNames.find((n) => normalizarClave(n).startsWith("facturaci"));
  if (!nombreHoja) {
    throw new Error(`No se encontró una hoja "Facturación" en el archivo. Hojas disponibles: ${libro.SheetNames.join(", ")}`);
  }

  const ws = libro.Sheets[nombreHoja];
  const ref = ws["!ref"];
  if (!ref) throw new Error(`La hoja ${nombreHoja} está vacía.`);
  const rango = XLSX.utils.decode_range(ref);

  // Fila de encabezados: se busca la que contiene "DISPATCH DATE" (no se
  // asume una posición fija — mismo criterio que se corrigió en Importar PL
  // para plantillas con distinto n° de filas de título/totales antes del
  // encabezado).
  let filaEncabezados = -1;
  for (let R = rango.s.r; R <= Math.min(rango.e.r, rango.s.r + MAX_FILAS_BUSQUEDA_ENCABEZADO); R++) {
    for (let C = rango.s.c; C <= rango.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (normalizarClave(valorCrudo(ws, addr)) === "dispatch date") {
        filaEncabezados = R;
        break;
      }
    }
    if (filaEncabezados !== -1) break;
  }
  if (filaEncabezados === -1) {
    throw new Error(`No se encontró la fila de encabezados (columna "DISPATCH DATE") en la hoja ${nombreHoja}.`);
  }

  // Encabezado normalizado -> índice de columna, para las 130 columnas.
  const columnas: { indice: number; encabezado: string }[] = [];
  for (let C = rango.s.c; C <= rango.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: filaEncabezados, c: C });
    const encabezado = normalizar(valorCrudo(ws, addr));
    if (encabezado !== "") columnas.push({ indice: C, encabezado });
  }

  const indicePorEncabezado = new Map(columnas.map((c) => [normalizarClave(c.encabezado), c.indice]));
  const errores: string[] = [];
  const col = {} as Record<keyof typeof COLUMNAS_TIPADAS, number>;
  for (const [clave, encabezado] of Object.entries(COLUMNAS_TIPADAS)) {
    const indice = indicePorEncabezado.get(normalizarClave(encabezado));
    if (indice === undefined) {
      errores.push(`No se encontró la columna "${encabezado}" en la fila de encabezados.`);
    } else {
      col[clave as keyof typeof COLUMNAS_TIPADAS] = indice;
    }
  }
  if (errores.length > 0) {
    return { nombreHoja, totalFilasLeidas: 0, filas: [], errores };
  }

  const filas: FilaHistoricaParseada[] = [];
  let totalFilasLeidas = 0;
  for (let R = filaEncabezados + 1; R <= rango.e.r; R++) {
    const addr = (C: number) => XLSX.utils.encode_cell({ r: R, c: C });

    const dispWeekCrudo = valorCrudo(ws, addr(col.dispWeek));
    const dispatchDateCrudo = valorCrudo(ws, addr(col.dispatchDate));
    const customerCrudo = valorCrudo(ws, addr(col.customer));
    const dispWeekValido = typeof dispWeekCrudo === "number" && dispWeekCrudo > 0;
    const dispatchDateValida = dispatchDateCrudo instanceof Date && !Number.isNaN(dispatchDateCrudo.getTime());
    const customerValido = normalizar(customerCrudo) !== "";
    // Filas totalmente vacías (sin semana/fecha/cliente) no son datos
    // reales — se descartan en silencio, igual que el script actual.
    if (!dispWeekValido && !dispatchDateValida && !customerValido) continue;
    totalFilasLeidas++;
    if (!dispWeekValido || !dispatchDateValida || !customerValido) continue;

    const datosOriginales: Record<string, string | number | boolean | null> = {};
    const camposConError: string[] = [];
    for (const { indice, encabezado } of columnas) {
      const a = addr(indice);
      const cell = ws[a];
      datosOriginales[encabezado] = valorJson(ws, a);
      if (cell && cell.t === "e") camposConError.push(encabezado);
    }

    filas.push({
      sourceRowNumber: R + 1, // fila real del Excel (1-indexado, como se ve en la app)
      dispatchDate: dispatchDateCrudo,
      dispWeek: dispWeekCrudo,
      customer: normalizar(customerCrudo),
      market: normalizar(valorCrudo(ws, addr(col.market))),
      originPort: normalizar(valorCrudo(ws, addr(col.originPort))),
      destinationCountry: normalizar(valorCrudo(ws, addr(col.destinationCountry))).toUpperCase(),
      format: normalizar(valorCrudo(ws, addr(col.format))),
      po: normalizar(valorCrudo(ws, addr(col.po))),
      transportMode: normalizar(valorCrudo(ws, addr(col.transportMode))),
      weekEta: aEnteroONulo(valorCrudo(ws, addr(col.weekEta))),
      weekAta: aEnteroONulo(valorCrudo(ws, addr(col.weekAta))),
      statusEmbarque: normalizar(valorCrudo(ws, addr(col.statusEmbarque))),
      settlementStatus: normalizar(valorCrudo(ws, addr(col.settlementStatus))),
      variety: normalizar(valorCrudo(ws, addr(col.variety))),
      type: normalizar(valorCrudo(ws, addr(col.type))),
      label: normalizar(valorCrudo(ws, addr(col.label))),
      destino: aDestino(valorCrudo(ws, addr(col.destino))),
      totalFob: aNumero(valorCrudo(ws, addr(col.totalFob))),
      invoicedAmount: aNumero(valorCrudo(ws, addr(col.invoicedAmount))),
      cifLiquidatedTariffs: aNumero(valorCrudo(ws, addr(col.cifLiquidatedTariffs))),
      netWeight: aNumero(valorCrudo(ws, addr(col.netWeight))),
      netKilosLiquidated: aNumero(valorCrudo(ws, addr(col.netKilosLiquidated))),
      datosOriginales,
      camposConError,
    });
  }

  return { nombreHoja, totalFilasLeidas, filas, errores };
}
