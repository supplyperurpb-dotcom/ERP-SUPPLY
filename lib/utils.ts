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

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
