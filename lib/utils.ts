import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

// Número de semana ISO-8601 (1-53) de una fecha, usado para agrupar los
// reportes de Acopio por semana de cosecha.
export function semanaISO(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}
