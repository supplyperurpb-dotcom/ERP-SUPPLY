import type { FilaFacturacion } from "@/lib/facturacion-exportacion";

// Subconjunto tipado compartido por FacturacionExportacion (dashboard
// original) y HistoricalBilling (migración histórica) — mismos nombres y
// tipos a propósito (ver prisma/schema.prisma), para poder mapear ambas
// filas de Prisma al mismo FilaFacturacion con una sola función.
type FilaConSubconjuntoTipado = {
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
  totalFob: { toString(): string };
  invoicedAmount: { toString(): string };
  cifLiquidatedTariffs: { toString(): string };
  netWeight: { toString(): string };
  netKilosLiquidated: { toString(): string };
};

export function aFilaFacturacion(f: FilaConSubconjuntoTipado): FilaFacturacion {
  return {
    dispatchDate: f.dispatchDate,
    dispWeek: f.dispWeek,
    customer: f.customer,
    market: f.market,
    originPort: f.originPort,
    destinationCountry: f.destinationCountry,
    format: f.format,
    po: f.po,
    transportMode: f.transportMode,
    weekEta: f.weekEta,
    weekAta: f.weekAta,
    statusEmbarque: f.statusEmbarque,
    settlementStatus: f.settlementStatus,
    variety: f.variety,
    type: f.type,
    label: f.label,
    destino: f.destino,
    totalFob: Number(f.totalFob),
    invoicedAmount: Number(f.invoicedAmount),
    cifLiquidatedTariffs: Number(f.cifLiquidatedTariffs),
    netWeight: Number(f.netWeight),
    netKilosLiquidated: Number(f.netKilosLiquidated),
  };
}

export const SELECT_SUBCONJUNTO_TIPADO = {
  dispatchDate: true,
  dispWeek: true,
  customer: true,
  market: true,
  originPort: true,
  destinationCountry: true,
  format: true,
  po: true,
  transportMode: true,
  weekEta: true,
  weekAta: true,
  statusEmbarque: true,
  settlementStatus: true,
  variety: true,
  type: true,
  label: true,
  destino: true,
  totalFob: true,
  invoicedAmount: true,
  cifLiquidatedTariffs: true,
  netWeight: true,
  netKilosLiquidated: true,
} as const;
