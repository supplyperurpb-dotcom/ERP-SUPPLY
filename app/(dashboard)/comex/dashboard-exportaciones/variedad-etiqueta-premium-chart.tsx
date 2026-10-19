"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { FilaVariedadEtiqueta } from "@/lib/facturacion-exportacion";

// Orden fijo (no alfabético), igual criterio que el resto del dashboard:
// solo las etiquetas que de verdad aparecen bajo PREMIUM se dibujan por
// variedad (JB/SB/S&C) — YL nunca aparece acá, es de Convencional.
const ORDEN_ETIQUETA = ["JB", "SB", "S&C"] as const;

type Punto = { variedad: string; totalKg: number; [clave: string]: string | number };

// Si la barra mide menos que esto, el % ya no "cabe" dentro de su color
// (queda flotando sobre fondo blanco) — se fuerza negro para que siga
// siendo legible.
const PCT_MIN_ALTURA_PX = 18;
const CLEARANCE_MIN_PX = 38;

function EtiquetaSuperior(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  payload?: Punto;
  etiqueta: string;
}) {
  const { x, y, width, height, payload, etiqueta } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) {
    return null;
  }
  const kg = payload[etiqueta];
  const pu = payload[`${etiqueta}__pu`];
  if (typeof kg !== "number" || kg <= 0) return null;
  const cx = Number(x) + Number(width) / 2;
  const topY = Number(y);
  const baseline = topY + Number(height);
  const anchorY = Math.min(topY, baseline - CLEARANCE_MIN_PX);
  return (
    <g>
      <text x={cx} y={anchorY - 20} textAnchor="middle" fontSize={11} fontWeight={600} fill={COLOR_EJE}>
        {formatCantidad(kg)} Kg
      </text>
      <text x={cx} y={anchorY - 6} textAnchor="middle" fontSize={11} fill={COLOR_EJE}>
        {typeof pu === "number" ? formatMoneda(pu, "USD") : ""}
      </text>
    </g>
  );
}

function EtiquetaPorcentaje(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number | boolean | null;
  etiqueta: string;
}) {
  const { x, y, width, height, value, etiqueta } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const alturaBarra = Number(height);
  const cx = Number(x) + Number(width) / 2;
  const cy = Number(y) + alturaBarra - 6;
  // Pedido explícito: solo SB va en blanco (y únicamente si la barra es
  // lo bastante alta); JB y S&C siempre en negro.
  const color = etiqueta === "SB" && alturaBarra >= PCT_MIN_ALTURA_PX ? "#fff" : "#000";
  return (
    <text x={cx} y={cy} textAnchor="middle" fontSize={12} fill={color}>
      {pct.toFixed(0)}%
    </text>
  );
}

// Tooltip a medida: kg real, % y PU CIF de cada etiqueta (viajan junto
// al punto como "<etiqueta>__pct"/"__pu").
function ContenidoTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload as Punto | undefined;
  const entradas = payload.filter((p) => Number(p.value) > 0);
  if (!fila || entradas.length === 0) return null;

  return (
    <div className="rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {entradas.map((p) => {
        const etiqueta = String(p.dataKey);
        const pct = fila[`${etiqueta}__pct`];
        const pu = fila[`${etiqueta}__pu`];
        return (
          <p key={etiqueta} style={{ color: p.color }}>
            {etiqueta}: {formatCantidad(Number(p.value))} Kg
            {typeof pct === "number" ? ` (${pct.toFixed(0)}%)` : ""}
            {typeof pu === "number" ? ` · PU CIF Fact.: ${formatMoneda(pu, "USD")}` : ""}
          </p>
        );
      })}
    </div>
  );
}

// Mezcla de etiquetas (JB/SB/S&C) dentro de lo PREMIUM, por variedad —
// 2 o 3 barras según cuáles etiquetas tenga esa variedad, con el % de
// cada una sobre el total PREMIUM de la variedad adentro de la barra, y
// encima de cada barra sus kg y su PU CIF facturado. Datos ya calculados
// por calcularExportacionesPorVariedadYEtiquetaPremium
// (lib/facturacion-exportacion.ts).
export function VariedadEtiquetaPremiumChart({ titulo, datos }: { titulo: string; datos: FilaVariedadEtiqueta[] }) {
  const etiquetasPresentes = new Set(datos.flatMap((f) => f.porEtiqueta.map((s) => s.etiqueta)));
  const series = ORDEN_ETIQUETA.filter((e) => etiquetasPresentes.has(e));
  // Importante: cada serie necesita su clave en TODAS las categorías (en
  // 0 si esa variedad no tiene esa etiqueta), aunque esté vacía — si se
  // omite, recharts corre/compacta esa serie en las categorías donde sí
  // aparece, descolocando barra y etiqueta hacia la variedad equivocada.
  const puntos: Punto[] = datos.map((f) => {
    const punto: Punto = { variedad: f.variedad, totalKg: f.totalKg };
    for (const serie of series) {
      const dato = f.porEtiqueta.find((s) => s.etiqueta === serie);
      punto[serie] = dato?.kg ?? 0;
      punto[`${serie}__pct`] = dato?.pct ?? 0;
      punto[`${serie}__pu`] = dato?.puCifFacturado ?? 0;
    }
    return punto;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {puntos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este filtro.</p>
        ) : (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={puntos} margin={{ top: 40, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
                <XAxis dataKey="variedad" fontSize={12} stroke={COLOR_EJE} tickLine={false} />
                <YAxis domain={[0, (max: number) => max * 1.25]} tick={false} axisLine={false} tickLine={false} />
                <Tooltip content={(props) => <ContenidoTooltip {...props} />} />
                <Legend />
                {series.map((etiqueta, i) => (
                  <Bar key={etiqueta} dataKey={etiqueta} fill={colorPara(etiqueta, i)}>
                    <LabelList content={(props) => <EtiquetaSuperior {...props} etiqueta={etiqueta} />} />
                    <LabelList
                      dataKey={`${etiqueta}__pct`}
                      content={(props) => <EtiquetaPorcentaje {...props} etiqueta={etiqueta} />}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
