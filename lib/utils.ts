import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Calcula el siguiente número de una serie tipo "IF-0001" a partir del
// MÁXIMO correlativo ya usado (no de `count()` de filas). Usar `count()+1`
// para numerar es frágil: si alguna fila se borra (o el conteo no coincide
// con el correlativo más alto por cualquier otro motivo), el siguiente
// número calculado puede coincidir con uno que ya existe y la creación
// falla por violar la restricción de unicidad. Se le pasan los números ya
// existentes de esa serie (ya filtrados por prefijo) y devuelve el
// siguiente, sin importar huecos en la secuencia.
export function maximoNumero(numerosExistentes: string[], prefijo: string): number {
  let maximo = 0;
  for (const numero of numerosExistentes) {
    // Si dos series comparten la misma longitud de prefijo (p. ej. "SP-" y
    // "SS-"), un número de la otra serie no debe contarse como propio solo
    // porque al recortar coincida en longitud.
    if (!numero.startsWith(prefijo)) continue;
    const valor = parseInt(numero.slice(prefijo.length), 10);
    if (Number.isFinite(valor) && valor > maximo) maximo = valor;
  }
  return maximo;
}

export function siguienteNumero(numerosExistentes: string[], prefijo: string, ancho = 4): string {
  return `${prefijo}${String(maximoNumero(numerosExistentes, prefijo) + 1).padStart(ancho, "0")}`;
}

// Reparte un monto total (p. ej. el flete de un ingreso/traslado/consumo)
// entre varias líneas según su peso (p. ej. el subtotal de cada línea), de
// forma que la suma de lo repartido sea exactamente igual al total (el
// redondeo de la última línea absorbe la diferencia de centavos). Si todos
// los pesos son 0 (o el total es 0/null), reparte el monto en partes iguales
// para no perder el flete por una división entre cero.
export function prorratear(total: number | null | undefined, pesos: number[]): number[] {
  const montoTotal = total ?? 0;
  if (pesos.length === 0) return [];
  if (montoTotal === 0) return pesos.map(() => 0);

  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  const partes =
    sumaPesos > 0
      ? pesos.map((peso) => (montoTotal * peso) / sumaPesos)
      : pesos.map(() => montoTotal / pesos.length);

  const partesRedondeadas = partes.map((p) => Math.round(p * 10000) / 10000);
  const diferencia = montoTotal - partesRedondeadas.reduce((a, b) => a + b, 0);
  if (partesRedondeadas.length > 0) {
    partesRedondeadas[partesRedondeadas.length - 1] += Math.round(diferencia * 10000) / 10000;
  }
  return partesRedondeadas;
}

// Los campos `Decimal` de Prisma son instancias de clase (decimal.js), no
// objetos planos, así que React no permite pasarlos como prop de un Server
// Component a un Client Component ("Only plain objects can be passed...").
// Se usa antes de pasar resultados de Prisma con campos Decimal a un Client
// Component (p. ej. las tablas/diálogos de SKU y Catálogo de taras).
export function serializar<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// Los campos de fecha "de calendario" (fechaCosecha, fechaDespacho, fecha de
// solicitud/orden, fechaEmision, fechaTraslado, ...) se capturan con
// <input type="date"> ("2026-09-11") y se guardan vía z.coerce.date(), que
// los ancla a medianoche UTC de ese día. Por eso se formatean en UTC por
// defecto: formatearlos en la zona horaria local del servidor (Node no usa
// UTC por defecto salvo que el SO/proceso esté configurado así) los movería
// un día para atrás en cualquier huso horario detrás de UTC, incluido Perú.
// Los timestamps reales (createdAt, fechaIngreso, movimiento.fecha, ...) no
// deben usar este default — se les pasa { timeZone: "America/Lima" }.
export function formatDate(date: Date | string, opciones: { timeZone?: string } = {}) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: opciones.timeZone ?? "UTC",
  }).format(d);
}

// A diferencia de formatDate, esto se usa para timestamps reales (momentos,
// no fechas de calendario elegidas en un <input type="date">), así que se
// fija a la zona horaria de la empresa (Perú, UTC-5 todo el año, sin
// horario de verano) en vez de UTC — de lo contrario un ingreso registrado
// de noche (hora Perú) podría mostrar el día siguiente.
export function formatDateTime(date: Date | string, opciones: { timeZone?: string } = {}) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: opciones.timeZone ?? "America/Lima",
  }).format(d);
}

export function formatKg(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return `${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`;
}

export function formatMoneda(value: number | string, moneda: string = "PEN") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(n);
}

// Fecha/hora LOCALES del navegador en formato "YYYY-MM-DD" / "HH:MM", listas
// para precargar un <input type="date"> o <input type="time">.
// toISOString() no sirve para esto: da la fecha en UTC, que puede caer un
// día antes o después según la hora local.
export function fechaLocalHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export function horaLocalAhora(): string {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

// Convierte un filtro "desde"/"hasta" (valores de <input type="date">, ej.
// "2026-09-11") en límites gte/lte para Prisma, anclados al día calendario
// en Perú ("-05:00") en vez de la hora local del proceso de Node — mismo
// criterio que formatDateTime() para fechaIngreso, para que el filtro y lo
// que se muestra en pantalla siempre coincidan sin importar dónde corra el
// servidor.
export function rangoFechaIngreso(desde?: string, hasta?: string): { gte?: Date; lte?: Date } | undefined {
  const rango: { gte?: Date; lte?: Date } = {};
  if (desde) rango.gte = new Date(`${desde}T00:00:00-05:00`);
  if (hasta) rango.lte = new Date(`${hasta}T23:59:59.999-05:00`);
  return Object.keys(rango).length > 0 ? rango : undefined;
}

// A diferencia de rangoFechaIngreso, esto filtra fechas "de calendario"
// (fechaCosecha), guardadas como medianoche UTC del día elegido en el
// <input type="date"> (ver comentario de formatDate) — así que el rango se
// ancla en UTC, no en la zona horaria de Perú, para que coincida con cómo
// se guardó.
export function rangoFechaCosecha(desde?: string, hasta?: string): { gte?: Date; lte?: Date } | undefined {
  const rango: { gte?: Date; lte?: Date } = {};
  if (desde) rango.gte = new Date(`${desde}T00:00:00.000Z`);
  if (hasta) rango.lte = new Date(`${hasta}T23:59:59.999Z`);
  return Object.keys(rango).length > 0 ? rango : undefined;
}

// Semana y año ISO-8601 de una fecha (el año ISO puede diferir del año
// calendario cerca del límite de año, ej. 29-dic puede caer en la semana 1
// del año siguiente). Se usa para agrupar y filtrar los reportes de Acopio
// por semana de cosecha sin que semanas de años distintos choquen entre sí.
export function semanaISOConAnio(fecha: Date): { anio: number; semana: number } {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  return { anio: d.getUTCFullYear(), semana };
}

// Número de semana ISO-8601 (1-53) de una fecha, sin el año. Ver
// semanaISOConAnio si además necesitas distinguir semanas de años distintos.
export function semanaISO(fecha: Date): number {
  return semanaISOConAnio(fecha).semana;
}

// Rango [lunes 00:00, domingo 23:59:59.999] en UTC de una semana ISO dada
// (inverso de semanaISOConAnio), usado para filtrar el reporte de Acopio
// por semana de cosecha. El 4 de enero siempre cae en la semana 1 del año
// ISO correspondiente.
export function rangoSemanaISO(anio: number, semana: number): { gte: Date; lte: Date } {
  const enero4 = new Date(Date.UTC(anio, 0, 4));
  const diaSemanaEnero4 = enero4.getUTCDay() || 7;
  const lunes = new Date(enero4);
  lunes.setUTCDate(enero4.getUTCDate() - diaSemanaEnero4 + 1 + (semana - 1) * 7);
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  domingo.setUTCHours(23, 59, 59, 999);
  return { gte: lunes, lte: domingo };
}
