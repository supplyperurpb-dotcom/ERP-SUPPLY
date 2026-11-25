import { calcularKpis, type FilaFacturacion } from "@/lib/facturacion-exportacion";

// Compara el Dashboard Exportaciones original (facturacion_exportacion,
// sincronizado a mano desde el Excel) contra la migración histórica
// (HistoricalBilling) — Etapa C del plan "COMEX: Base de datos
// centralizada de Exportaciones". Solo compara los indicadores que el
// motor de cálculo YA tiene probado (lib/facturacion-exportacion.ts): el
// Excel de Facturación trae ~109 columnas más (fletes, seguros, notas de
// crédito/débito, anticipos...) que facturacion_exportacion NUNCA
// capturó (solo guarda las ~21 que usa el dashboard), así que no hay
// ningún valor "de Excel" confiable contra el cual compararlas todavía
// — están preservadas en HistoricalBilling.datosOriginales para cuando
// se decida incorporarlas, pero compararlas acá sería inventar un
// resultado, no verificarlo.

export type EstadoConciliacion = "COINCIDE" | "DIFERENCIA_DETECTADA";

export type FilaConciliacionKpi = {
  indicador: string;
  excel: number;
  supabase: number;
  diferencia: number;
  estado: EstadoConciliacion;
  formato: "entero" | "kg" | "moneda";
};

const EPSILON = 0.01;

function fila(indicador: string, excel: number, supabase: number, formato: FilaConciliacionKpi["formato"]): FilaConciliacionKpi {
  const diferencia = excel - supabase;
  return { indicador, excel, supabase, diferencia, estado: Math.abs(diferencia) <= EPSILON ? "COINCIDE" : "DIFERENCIA_DETECTADA", formato };
}

export function compararKpis(filasExcel: FilaFacturacion[], filasSupabase: FilaFacturacion[]): FilaConciliacionKpi[] {
  const kpisExcel = calcularKpis(filasExcel);
  const kpisSupabase = calcularKpis(filasSupabase);
  const poExcel = new Set(filasExcel.map((f) => f.po)).size;
  const poSupabase = new Set(filasSupabase.map((f) => f.po)).size;
  const puCifFacturadoExcel = kpisExcel.netWeight > 0 ? kpisExcel.invoicedAmount / kpisExcel.netWeight : 0;
  const puCifFacturadoSupabase = kpisSupabase.netWeight > 0 ? kpisSupabase.invoicedAmount / kpisSupabase.netWeight : 0;
  const puCifLiquidadoExcel = kpisExcel.netKilosLiquidated > 0 ? kpisExcel.cifLiquidatedTariffs / kpisExcel.netKilosLiquidated : 0;
  const puCifLiquidadoSupabase =
    kpisSupabase.netKilosLiquidated > 0 ? kpisSupabase.cifLiquidatedTariffs / kpisSupabase.netKilosLiquidated : 0;

  return [
    fila("Registros", filasExcel.length, filasSupabase.length, "entero"),
    fila("PO distintos", poExcel, poSupabase, "entero"),
    fila("Kg Facturados", kpisExcel.netWeight, kpisSupabase.netWeight, "kg"),
    fila("Facturación (Invoiced Amount)", kpisExcel.invoicedAmount, kpisSupabase.invoicedAmount, "moneda"),
    fila("Kg Liquidados", kpisExcel.netKilosLiquidated, kpisSupabase.netKilosLiquidated, "kg"),
    fila("CIF Liquidated (Tariffs)", kpisExcel.cifLiquidatedTariffs, kpisSupabase.cifLiquidatedTariffs, "moneda"),
    fila("PU CIF Facturado", puCifFacturadoExcel, puCifFacturadoSupabase, "moneda"),
    fila("PU CIF Liquidado", puCifLiquidadoExcel, puCifLiquidadoSupabase, "moneda"),
  ];
}

// Conciliación por registro: facturacion_exportacion no guarda el número
// de fila original del Excel, así que no hay una llave 1:1 perfecta entre
// ambas tablas — se empareja por una combinación que, en la práctica,
// identifica una línea del Excel (PO + fecha + cliente + variedad +
// formato + etiqueta + kg), igual que se vería a simple vista comparando
// dos filas. Si no hay match exacto, queda explícitamente "sin match" en
// vez de asumir cuál le corresponde.
export type DiferenciaRegistro = {
  clave: string;
  enExcelSinMatch: boolean;
  enSupabaseSinMatch: boolean;
};

function claveFila(f: FilaFacturacion): string {
  return [
    f.po,
    f.dispatchDate.toISOString().slice(0, 10),
    f.customer,
    f.variety,
    f.format,
    f.label,
    f.netWeight.toFixed(3),
  ].join("|");
}

export function compararRegistros(filasExcel: FilaFacturacion[], filasSupabase: FilaFacturacion[]): {
  totalExcel: number;
  totalSupabase: number;
  coincidencias: number;
  diferencias: DiferenciaRegistro[];
} {
  const clavesExcel = new Map<string, number>();
  for (const f of filasExcel) clavesExcel.set(claveFila(f), (clavesExcel.get(claveFila(f)) ?? 0) + 1);
  const clavesSupabase = new Map<string, number>();
  for (const f of filasSupabase) clavesSupabase.set(claveFila(f), (clavesSupabase.get(claveFila(f)) ?? 0) + 1);

  const todasLasClaves = new Set([...clavesExcel.keys(), ...clavesSupabase.keys()]);
  const diferencias: DiferenciaRegistro[] = [];
  let coincidencias = 0;
  for (const clave of todasLasClaves) {
    const enExcel = clavesExcel.get(clave) ?? 0;
    const enSupabase = clavesSupabase.get(clave) ?? 0;
    if (enExcel === enSupabase) {
      coincidencias += enExcel;
      continue;
    }
    diferencias.push({ clave, enExcelSinMatch: enExcel > enSupabase, enSupabaseSinMatch: enSupabase > enExcel });
  }

  return { totalExcel: filasExcel.length, totalSupabase: filasSupabase.length, coincidencias, diferencias };
}
