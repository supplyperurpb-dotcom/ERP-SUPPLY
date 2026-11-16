import { KPICard } from "@/components/ui/cards/kpi-card";
import { cn, formatCantidad } from "@/lib/utils";
import type { ResumenTrazabilidad } from "@/lib/trazabilidad";

// Colores fijos por estado (mismo criterio en la barra segmentada, el
// badge de cada línea y la leyenda) — no son tokens nuevos del tema, son
// los mismos tonos de Tailwind que ya usan los Badge success/warning de
// este ERP (ver components/ui/badge.tsx).
const COLOR_ATENDIDO = "#059669"; // emerald-600
const COLOR_PENDIENTE_CON_ORDEN = "#d97706"; // amber-600
const COLOR_PENDIENTE_SIN_ORDEN = "#64748b"; // slate-500
const COLOR_CERRADO_SIN_ATENDER = "#dc2626"; // red-600

export function ResumenTrazabilidadCards({ resumen }: { resumen: ResumenTrazabilidad }) {
  const total =
    resumen.cantidadAtendida +
    resumen.cantidadPendienteConOrden +
    resumen.cantidadPendienteSinOrden +
    resumen.cantidadCerradoSinAtender;

  const segmentos = [
    { etiqueta: "Atendido", valor: resumen.cantidadAtendida, color: COLOR_ATENDIDO },
    { etiqueta: "Pendiente con orden", valor: resumen.cantidadPendienteConOrden, color: COLOR_PENDIENTE_CON_ORDEN },
    { etiqueta: "Pendiente sin orden", valor: resumen.cantidadPendienteSinOrden, color: COLOR_PENDIENTE_SIN_ORDEN },
    { etiqueta: "Cerrado sin atender", valor: resumen.cantidadCerradoSinAtender, color: COLOR_CERRADO_SIN_ATENDER },
  ].filter((s) => s.valor > 0);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total de códigos solicitados" value={resumen.totalCodigos.toLocaleString("es-PE")} />
        <KPICard label="Cantidad solicitada" value={formatCantidad(resumen.cantidadSolicitada)} />
        <KPICard
          label="Cantidad atendida"
          value={formatCantidad(resumen.cantidadAtendida)}
          secondaryLine={`${resumen.pctAtendido.toFixed(1)}% del total`}
          paleta={{ titulo: COLOR_ATENDIDO }}
        />
        <KPICard
          label="Cantidad pendiente"
          value={formatCantidad(resumen.cantidadPendienteConOrden + resumen.cantidadPendienteSinOrden)}
          secondaryLine={`${resumen.pctPendiente.toFixed(1)}% del total`}
          paleta={{ titulo: COLOR_PENDIENTE_CON_ORDEN }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KPICard
          label="Pendiente con orden de compra"
          value={formatCantidad(resumen.cantidadPendienteConOrden)}
          paleta={{ titulo: COLOR_PENDIENTE_CON_ORDEN }}
        />
        <KPICard
          label="Pendiente sin orden de compra"
          value={formatCantidad(resumen.cantidadPendienteSinOrden)}
          paleta={{ titulo: COLOR_PENDIENTE_SIN_ORDEN }}
        />
      </div>

      {total > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Distribución de atención</p>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {segmentos.map((s) => (
              <div
                key={s.etiqueta}
                className="h-full"
                style={{ width: `${(s.valor / total) * 100}%`, backgroundColor: s.color }}
                title={`${s.etiqueta}: ${formatCantidad(s.valor)}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {segmentos.map((s) => (
              <div key={s.etiqueta} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full")} style={{ backgroundColor: s.color }} />
                {s.etiqueta}: <span className="font-medium tabular-nums text-foreground">{formatCantidad(s.valor)}</span> (
                {((s.valor / total) * 100).toFixed(1)}%)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
