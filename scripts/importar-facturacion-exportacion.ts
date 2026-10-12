// Sincroniza la tabla facturacion_exportacion con la hoja "Facturación" del
// Excel de facturación de exportación. Se corre a mano (no es parte del
// build) cada vez que hay un Excel nuevo:
//
//   npx tsx --env-file=.env scripts/importar-facturacion-exportacion.ts [ruta-al-excel]
//
// Si no se pasa ruta, usa la última que se compartió por defecto. Vuelve a
// crear la tabla desde cero (trunca e inserta todo de nuevo) — no hay
// edición manual de estas filas desde la app, así que no hace falta un
// merge incremental.
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const RUTA_POR_DEFECTO = "C:\\Users\\josem\\Downloads\\02_Facturación Exportación RPB_2026.xlsx";
const FILA_ENCABEZADOS = 6; // 1-indexado, igual que se ve en Excel

// Normaliza un encabezado (algunos vienen con salto de línea en medio,
// ej. "INVOICED\nAMOUNT - 1 (CIF)") para poder matchearlo por texto exacto
// sin depender de en qué columna esté.
function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

const COLUMNAS = {
  dispatchDate: "DISPATCH DATE",
  dispWeek: "DISP. WEEK",
  customer: "CUSTOMER",
  market: "MARKET",
  destinationCountry: "DESTINATION COUNTRY",
  format: "FORMAT",
  invoicedAmount: "INVOICED AMOUNT - 1 (CIF)",
  cifLiquidatedTariffs: "CIF Liquidated (Tariffs)",
  netWeight: "NET WEIGHT",
  netKilosLiquidated: "Net Kilos Liquidated",
} as const;

function aNumero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const n = Number(valor.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function aTexto(valor: unknown): string {
  return normalizar(valor);
}

function aFecha(valor: unknown): Date | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;
  return null;
}

async function main() {
  const rutaExcel = process.argv[2] || RUTA_POR_DEFECTO;
  console.log("Leyendo:", rutaExcel);

  const libro = XLSX.readFile(rutaExcel, { cellDates: true });
  const nombreHoja = libro.SheetNames.find((n) => n.toLowerCase().startsWith("facturaci"));
  if (!nombreHoja) {
    throw new Error(`No se encontró una hoja "Facturación" en el archivo. Hojas disponibles: ${libro.SheetNames.join(", ")}`);
  }
  console.log("Hoja encontrada:", nombreHoja);

  const hoja = libro.Sheets[nombreHoja];
  const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, range: FILA_ENCABEZADOS - 1, blankrows: false });

  const encabezados = filas[0].map(normalizar);
  const indicePorColumna = Object.fromEntries(
    Object.entries(COLUMNAS).map(([clave, encabezado]) => [clave, encabezados.indexOf(encabezado)])
  ) as Record<keyof typeof COLUMNAS, number>;

  for (const [clave, indice] of Object.entries(indicePorColumna)) {
    if (indice === -1) {
      throw new Error(`No se encontró la columna "${COLUMNAS[clave as keyof typeof COLUMNAS]}" en la fila de encabezados.`);
    }
  }

  const filasDeDatos = filas.slice(1);
  const registros = filasDeDatos
    .map((fila) => ({
      dispatchDate: aFecha(fila[indicePorColumna.dispatchDate]),
      dispWeek: aNumero(fila[indicePorColumna.dispWeek]),
      customer: aTexto(fila[indicePorColumna.customer]),
      market: aTexto(fila[indicePorColumna.market]),
      destinationCountry: aTexto(fila[indicePorColumna.destinationCountry]),
      format: aTexto(fila[indicePorColumna.format]),
      invoicedAmount: aNumero(fila[indicePorColumna.invoicedAmount]),
      cifLiquidatedTariffs: aNumero(fila[indicePorColumna.cifLiquidatedTariffs]),
      netWeight: aNumero(fila[indicePorColumna.netWeight]),
      netKilosLiquidated: aNumero(fila[indicePorColumna.netKilosLiquidated]),
    }))
    // Filas totalmente vacías (sin semana ni fecha) no son datos reales —
    // se descartan en vez de insertarlas con valores inventados.
    .filter((r): r is typeof r & { dispatchDate: Date } => r.dispWeek > 0 && r.dispatchDate !== null && r.customer !== "");

  console.log(`Filas con datos a importar: ${registros.length} (de ${filasDeDatos.length} filas leídas)`);

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction([
      prisma.facturacionExportacion.deleteMany({}),
      prisma.facturacionExportacion.createMany({ data: registros }),
    ]);
    console.log(`Listo: ${registros.length} filas sincronizadas en facturacion_exportacion.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error al importar:", e);
  process.exit(1);
});
