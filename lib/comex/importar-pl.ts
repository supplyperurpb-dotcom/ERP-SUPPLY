import * as XLSX from "xlsx";

// Parsea el Excel "Packing List (Reply)" que el cliente (Driscoll's) envía
// por embarque — ver el plan de "COMEX > Importar PL". Puro: no toca
// Prisma ni Supabase, solo lee el archivo y arma el resultado + errores/
// advertencias. La verificación de duplicados (shipNumber/hash ya
// existentes) se hace aparte, en el server action, que sí tiene acceso a
// la base de datos.

const MAX_FILAS_BUSQUEDA_ENCABEZADO = 20; // cuántas filas iniciales se revisan buscando la fila de encabezados

export type PalletImportado = {
  palletNumber: string;
  itemFruitCode: number | null;
  descripcionSku: string | null;
  variedad: string;
  label: string | null;
  fruitType: string | null;
  cases: number;
  kgPorSku: number | null;
  pesoNetoKg: number;
  thermographRecorder: string | null;
  thermographType: string | null;
  tipoBolsaLiner: string | null;
  atmosferaControlada: string | null;
  codeDemea: string | null;
  trazabilityCodeDoc: string | null;
  lpnDriscolls: string | null;
  fechaCosecha: Date | null;
};

export type EncabezadoEmbarqueImportado = {
  shipNumber: string;
  growerCode: number | null;
  grower: string | null;
  consignee: string | null;
  notify: string | null;
  naviera: string | null; // "Shipline/Airline"
  vessel: string | null;
  contenedor: string | null; // "Container/AWB"
  blSwb: string | null;
  tipoEmbarque: string | null;
  origenPuerto: string | null;
  destinoPuerto: string | null;
  fechaCarga: Date | null;
  etd: Date | null;
  eta: Date | null;
  totalCasesExcel: number | null;
  totalNetWeightExcel: number | null;
};

export type ResultadoParsePL = {
  nombreHoja: string;
  embarque: EncabezadoEmbarqueImportado;
  pallets: PalletImportado[];
  errores: string[];
  advertencias: string[];
};

function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarClave(valor: unknown): string {
  return normalizar(valor).toLowerCase();
}

// Busca el índice de la primera columna cuyo encabezado normalizado
// coincida (comparación "contiene", no exacta) con alguno de los criterios
// — tolera variaciones menores entre distintas versiones de la plantilla
// del cliente (ej. "LPN Driscoll´s (DOTA)" vs "LPN Driscoll's").
function buscarColumna(encabezados: string[], criterios: string[]): number {
  const normalizados = encabezados.map(normalizarClave);
  for (const criterio of criterios) {
    const c = criterio.toLowerCase();
    const indice = normalizados.findIndex((h) => h === c);
    if (indice !== -1) return indice;
  }
  for (const criterio of criterios) {
    const c = criterio.toLowerCase();
    const indice = normalizados.findIndex((h) => h.includes(c));
    if (indice !== -1) return indice;
  }
  return -1;
}

function aTexto(valor: unknown): string | null {
  const texto = normalizar(valor);
  return texto === "" ? null : texto;
}

function aNumero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const n = Number(valor.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function aFecha(valor: unknown): Date | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;
  return null;
}

export function parsearPackingListExcel(buffer: Buffer): ResultadoParsePL {
  const libro = XLSX.read(buffer, { cellDates: true, type: "buffer" });
  const nombreHoja = libro.SheetNames.find((n) => normalizarClave(n).startsWith("packing list (reply"));
  if (!nombreHoja) {
    throw new Error(
      `No se encontró una hoja "Packing List (Reply)" en el archivo. Hojas disponibles: ${libro.SheetNames.join(", ")}`
    );
  }

  const hoja = libro.Sheets[nombreHoja];
  // `range` como número no recorta de forma confiable en este archivo (se
  // probó contra el Excel real) — se lee la hoja completa con header:1 y se
  // recorta a mano por índice. La cantidad de filas de título/totales antes
  // del encabezado VARÍA entre embarques (algunos traen el total de Cases y
  // Net weight en una sola fila, otros en dos) — por eso la fila de
  // encabezados se ubica buscando la que contiene "Ship Number", en vez de
  // asumir una posición fija.
  const todasLasFilas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false, defval: null });
  const indiceEncabezados = todasLasFilas
    .slice(0, MAX_FILAS_BUSQUEDA_ENCABEZADO)
    .findIndex((fila) => fila.some((celda) => normalizarClave(celda) === "ship number"));
  if (indiceEncabezados === -1) {
    throw new Error(`No se encontró la fila de encabezados (columna "Ship Number") en la hoja ${nombreHoja}.`);
  }
  const filasAntesDeEncabezados = todasLasFilas.slice(0, indiceEncabezados);
  const filas: unknown[][] = todasLasFilas.slice(indiceEncabezados);
  const encabezados = (filas[0] ?? []).map(normalizar);

  const col = {
    shipNumber: buscarColumna(encabezados, ["Ship Number"]),
    growerCode: buscarColumna(encabezados, ["Grower Code"]),
    grower: buscarColumna(encabezados, ["Grower"]),
    consignee: buscarColumna(encabezados, ["Consignee"]),
    notify: buscarColumna(encabezados, ["Notify"]),
    naviera: buscarColumna(encabezados, ["Shipline/Airline"]),
    vessel: buscarColumna(encabezados, ["Vessel/Flight"]),
    contenedor: buscarColumna(encabezados, ["Container/AWB"]),
    blSwb: buscarColumna(encabezados, ["BL/SWB"]),
    tipoEmbarque: buscarColumna(encabezados, ["Type Shipment"]),
    origenPuerto: buscarColumna(encabezados, ["Port of Loading"]),
    destinoPuerto: buscarColumna(encabezados, ["Port of Discharge"]),
    fechaCarga: buscarColumna(encabezados, ["Loading Date"]),
    etd: buscarColumna(encabezados, ["ETD"]),
    eta: buscarColumna(encabezados, ["ETA"]),
    itemFruit: buscarColumna(encabezados, ["Item Fruit"]),
    descripcionSku: buscarColumna(encabezados, ["Description SKU"]),
    variedad: buscarColumna(encabezados, ["Variety"]),
    label: buscarColumna(encabezados, ["Label"]),
    fruitType: buscarColumna(encabezados, ["Fruit Type"]),
    palletNumber: buscarColumna(encabezados, ["Pallet Number"]),
    cases: buscarColumna(encabezados, ["Cases"]),
    kgPorSku: buscarColumna(encabezados, ["Kg / SKU", "Kg/SKU"]),
    pesoNetoKg: buscarColumna(encabezados, ["Net weight"]),
    thermographRecorder: buscarColumna(encabezados, ["Thermograph Recorder"]),
    thermographType: buscarColumna(encabezados, ["Thermograph Type"]),
    tipoBolsaLiner: buscarColumna(encabezados, ["Type of bags or liners"]),
    atmosferaControlada: buscarColumna(encabezados, ["Controlled Atmosphere"]),
    codeDemea: buscarColumna(encabezados, ["Code (DEMEA)", "Code"]),
    trazabilityCodeDoc: buscarColumna(encabezados, ["Trazability Code (DOC)", "Trazability Code"]),
    lpnDriscolls: buscarColumna(encabezados, ["LPN"]),
    harvestDate: buscarColumna(encabezados, ["Harvest Date"]),
  };

  const errores: string[] = [];
  const advertencias: string[] = [];
  const columnasObligatorias: (keyof typeof col)[] = ["shipNumber", "variedad", "palletNumber", "cases", "pesoNetoKg"];
  for (const clave of columnasObligatorias) {
    if (col[clave] === -1) errores.push(`No se encontró la columna requerida para "${clave}" en la hoja ${nombreHoja}.`);
  }
  if (errores.length > 0) {
    return { nombreHoja, embarque: {} as EncabezadoEmbarqueImportado, pallets: [], errores, advertencias };
  }

  // Totales del propio Excel (en las filas de título/totales antes del
  // encabezado) — se usa solo para el chequeo de cuadre, no es obligatorio.
  // Se busca por columna en vez de asumir una fila fija porque algunas
  // plantillas reparten estos totales en más de una fila (ver comentario
  // arriba sobre indiceEncabezados).
  const buscarTotalColumna = (colIndice: number): number | null => {
    if (colIndice === -1) return null;
    for (const fila of filasAntesDeEncabezados) {
      const valor = aNumero(fila[colIndice]);
      if (valor !== null) return valor;
    }
    return null;
  };
  const totalCasesExcel = buscarTotalColumna(col.cases);
  const totalNetWeightExcel = buscarTotalColumna(col.pesoNetoKg);

  // Al final de la plantilla suelen quedar filas basura (restos de fórmulas
  // que evalúan a 0 o "" en vez de vacío) — se exige también Pallet Number
  // para contar como fila de datos real, no solo Ship Number.
  const filasDeDatos = filas.slice(1).filter((f) => aTexto(f[col.shipNumber]) !== null && aTexto(f[col.palletNumber]) !== null);
  if (filasDeDatos.length === 0) {
    errores.push("El archivo no tiene filas de datos (ninguna fila tiene Ship Number).");
    return { nombreHoja, embarque: {} as EncabezadoEmbarqueImportado, pallets: [], errores, advertencias };
  }

  const primera = filasDeDatos[0];
  const embarque: EncabezadoEmbarqueImportado = {
    shipNumber: aTexto(primera[col.shipNumber]) as string,
    growerCode: col.growerCode !== -1 ? (aNumero(primera[col.growerCode]) as number | null) : null,
    grower: col.grower !== -1 ? aTexto(primera[col.grower]) : null,
    consignee: col.consignee !== -1 ? aTexto(primera[col.consignee]) : null,
    notify: col.notify !== -1 ? aTexto(primera[col.notify]) : null,
    naviera: col.naviera !== -1 ? aTexto(primera[col.naviera]) : null,
    vessel: col.vessel !== -1 ? aTexto(primera[col.vessel]) : null,
    contenedor: col.contenedor !== -1 ? aTexto(primera[col.contenedor]) : null,
    blSwb: col.blSwb !== -1 ? aTexto(primera[col.blSwb]) : null,
    tipoEmbarque: col.tipoEmbarque !== -1 ? aTexto(primera[col.tipoEmbarque]) : null,
    origenPuerto: col.origenPuerto !== -1 ? aTexto(primera[col.origenPuerto]) : null,
    destinoPuerto: col.destinoPuerto !== -1 ? aTexto(primera[col.destinoPuerto]) : null,
    fechaCarga: col.fechaCarga !== -1 ? aFecha(primera[col.fechaCarga]) : null,
    etd: col.etd !== -1 ? aFecha(primera[col.etd]) : null,
    eta: col.eta !== -1 ? aFecha(primera[col.eta]) : null,
    totalCasesExcel,
    totalNetWeightExcel,
  };

  const pallets: PalletImportado[] = [];
  let sumaCases = 0;
  let sumaNetWeight = 0;

  filasDeDatos.forEach((fila, i) => {
    // Posición entre las filas CON datos (no el número de fila real del
    // Excel: filtrar las filas vacías del final de la plantilla corre esa
    // cuenta, así que un número de fila físico sería engañoso).
    const numeroLinea = i + 1;
    const shipNumberFila = aTexto(fila[col.shipNumber]);
    if (shipNumberFila !== embarque.shipNumber) {
      errores.push(`Línea ${numeroLinea}: trae un Ship Number distinto ("${shipNumberFila}") al del resto del archivo ("${embarque.shipNumber}").`);
      return;
    }
    const palletNumber = aTexto(fila[col.palletNumber]);
    const variedad = aTexto(fila[col.variedad]);
    const cases = aNumero(fila[col.cases]);
    const pesoNetoKg = aNumero(fila[col.pesoNetoKg]);
    if (!palletNumber) {
      errores.push(`Línea ${numeroLinea}: falta el Pallet Number.`);
      return;
    }
    if (!variedad) {
      errores.push(`Línea ${numeroLinea} (pallet ${palletNumber}): falta la Variety.`);
      return;
    }
    if (cases === null) {
      errores.push(`Línea ${numeroLinea} (pallet ${palletNumber}): Cases no es un número válido.`);
      return;
    }
    if (pesoNetoKg === null) {
      errores.push(`Línea ${numeroLinea} (pallet ${palletNumber}): Net weight no es un número válido.`);
      return;
    }

    sumaCases += cases;
    sumaNetWeight += pesoNetoKg;

    pallets.push({
      palletNumber,
      itemFruitCode: col.itemFruit !== -1 ? aNumero(fila[col.itemFruit]) : null,
      descripcionSku: col.descripcionSku !== -1 ? aTexto(fila[col.descripcionSku]) : null,
      variedad,
      label: col.label !== -1 ? aTexto(fila[col.label]) : null,
      fruitType: col.fruitType !== -1 ? aTexto(fila[col.fruitType]) : null,
      cases,
      kgPorSku: col.kgPorSku !== -1 ? aNumero(fila[col.kgPorSku]) : null,
      pesoNetoKg,
      thermographRecorder: col.thermographRecorder !== -1 ? aTexto(fila[col.thermographRecorder]) : null,
      thermographType: col.thermographType !== -1 ? aTexto(fila[col.thermographType]) : null,
      tipoBolsaLiner: col.tipoBolsaLiner !== -1 ? aTexto(fila[col.tipoBolsaLiner]) : null,
      atmosferaControlada: col.atmosferaControlada !== -1 ? aTexto(fila[col.atmosferaControlada]) : null,
      codeDemea: col.codeDemea !== -1 ? aTexto(fila[col.codeDemea]) : null,
      trazabilityCodeDoc: col.trazabilityCodeDoc !== -1 ? aTexto(fila[col.trazabilityCodeDoc]) : null,
      lpnDriscolls: col.lpnDriscolls !== -1 ? aTexto(fila[col.lpnDriscolls]) : null,
      fechaCosecha: col.harvestDate !== -1 ? aFecha(fila[col.harvestDate]) : null,
    });
  });

  if (totalCasesExcel !== null && Math.abs(totalCasesExcel - sumaCases) > 0.01) {
    advertencias.push(`La suma de Cases de las líneas (${sumaCases}) no coincide con el total del archivo (${totalCasesExcel}).`);
  }
  if (totalNetWeightExcel !== null && Math.abs(totalNetWeightExcel - sumaNetWeight) > 0.01) {
    advertencias.push(
      `La suma de Net weight de las líneas (${sumaNetWeight.toFixed(2)}) no coincide con el total del archivo (${totalNetWeightExcel.toFixed(2)}).`
    );
  }

  return { nombreHoja, embarque, pallets, errores, advertencias };
}
