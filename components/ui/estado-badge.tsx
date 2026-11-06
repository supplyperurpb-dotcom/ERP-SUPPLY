import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  estadoDocumentoVariant,
  activoVariant,
  activoLabel,
  ESTADO_DOCUMENTO_LABEL,
  type EstadoDocumento,
} from "@/lib/design/estado-variant";

/** Badge de estado de documento (Borrador/Pendiente/Aprobado/Rechazado/Anulado), color consistente en toda la app. */
export function EstadoBadge({ estado, className }: { estado: EstadoDocumento; className?: string }) {
  return (
    <Badge variant={estadoDocumentoVariant(estado)} className={className}>
      {ESTADO_DOCUMENTO_LABEL[estado]}
    </Badge>
  );
}

/** Badge de activo/inactivo para catálogos (proveedores, SKUs, camiones, etc.). */
export function ActivoBadge({ activo, className }: { activo: boolean; className?: string }) {
  return (
    <Badge variant={activoVariant(activo)} className={className}>
      {activoLabel(activo)}
    </Badge>
  );
}

/** Wrappers semánticos sobre Badge — mismo componente base, solo fijan el variant. */
export function SuccessBadge({ className, ...props }: Omit<BadgeProps, "variant">) {
  return <Badge variant="success" className={className} {...props} />;
}
export function WarningBadge({ className, ...props }: Omit<BadgeProps, "variant">) {
  return <Badge variant="warning" className={className} {...props} />;
}
export function DangerBadge({ className, ...props }: Omit<BadgeProps, "variant">) {
  return <Badge variant="destructive" className={className} {...props} />;
}
export function InfoBadge({ className, ...props }: Omit<BadgeProps, "variant">) {
  return <Badge variant="info" className={className} {...props} />;
}
