import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
