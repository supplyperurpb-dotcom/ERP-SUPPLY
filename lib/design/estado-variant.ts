import type { BadgeProps } from "@/components/ui/badge";

/**
 * Mapeo único estado→variant para el ciclo de vida de un documento
 * (Solicitud de Pedido, Orden de Compra, Ingreso, etc.). Antes copiado
 * como objeto literal en 8+ archivos — esta es la fuente de verdad.
 */
export type EstadoDocumento = "BORRADOR" | "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ANULADO";

export const ESTADO_DOCUMENTO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  ANULADO: "Anulado",
};

export function estadoDocumentoVariant(estado: EstadoDocumento): NonNullable<BadgeProps["variant"]> {
  switch (estado) {
    case "APROBADO":
      return "success";
    case "RECHAZADO":
    case "ANULADO":
      return "destructive";
    case "BORRADOR":
    case "PENDIENTE":
    default:
      return "secondary";
  }
}

/**
 * Mapeo único para el patrón activo/inactivo repetido en ~14 archivos.
 * Corrige de paso la única inconsistencia confirmada en la auditoría
 * (usuarios/lista/page.tsx usaba "destructive" para inactivo).
 */
export function activoVariant(activo: boolean): NonNullable<BadgeProps["variant"]> {
  return activo ? "success" : "secondary";
}

export function activoLabel(activo: boolean): string {
  return activo ? "Activo" : "Inactivo";
}
