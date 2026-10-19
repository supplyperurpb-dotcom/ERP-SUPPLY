"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { colorPara, COLOR_GRILLA, COLOR_EJE } from "./colores";
import type { FilaVariedadTipo } from "@/lib/facturacion-exportacion";

// Orden fijo (no alfabético): Premium primero, Convencional después,
// mismo criterio que el resto del dashboard para esta pareja.
const TIPOS = ["PREMIUM", "CONVENCIONAL"] as const;
const ETIQUETA_TIPO: Record<string, string> = { PREMIUM: "Premium", CONVENCIONAL: "Convencional" };

type Punto = { variedad: string; totalKg: number; [clave: string]: string | number };

// Alto mínimo (px) que se deja libre entre el techo de la barra y el
// texto de kg/PU, para que nunca se superponga con el % que va adentro
// de la barra (en barras muy cortas, su techo real queda a solo un par
// de píxeles de la base).
const CLEARANCE_MIN_PX = 38;

// Las 2 líneas de texto (Kg y PU) encima de cada barra van cada una en
// su propio LabelList, con su propio dataKey — así cada línea toma su
// valor por el mecanismo nativo de recharts (el payload de SU propia
// entrada). Un solo LabelList con "content" leyendo por índice en un
// array externo, o leyendo "payload" a mano, no es confiable: recharts
// filtra las barras de altura 0 antes de asignar el índice, y no
// reenvía "payload" a un content custom (solo x/y/width/height/value).
function anchorYDesdeBarra(y: number, height: number) {
  const baseline = y + height;
  // Nunca más abajo de "baseline - mínimo", aunque la barra sea casi plana.
  return Math.min(y, baseline - CLEARANCE_MIN_PX);
}

function EtiquetaKg(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number | boolean | null;
}) {
  const { x, y, width, height, value } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  const kg = Number(value);
  if (!Number.isFinite(kg) || kg <= 0) return null;
  const cx = Number(x) + Number(width) / 2;
  const anchorY = anchorYDesdeBarra(Number(y), Number(height));
  return (
    <text x={cx} y={anchorY - 20} textAnchor="middle" fontSize={11} fontWeight={600} fill={COLOR_EJE}>
      {formatCantidad(kg)} Kg
    </text>
  );
}

function EtiquetaPU(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number | boolean | null;
}) {
  const { x, y, width, height, value } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  const pu = Number(value);
  if (!Number.isFinite(pu) || pu <= 0) return null;
  const cx = Number(x) + Number(width) / 2;
  const anchorY = anchorYDesdeBarra(Number(y), Number(height));
  return (
    <text x={cx} y={anchorY - 6} textAnchor="middle" fontSize={11} fill={COLOR_EJE}>
      {formatMoneda(pu, "USD")}
    </text>
  );
}

// Si la barra mide menos que esto, el texto del % ya no "cabe" dentro de
// su propio color (queda flotando sobre el fondo blanco del gráfico) —
// en ese caso se fuerza negro sin importar el tipo, para que siga
// siendo legible (blanco sobre blanco sería invisible).
const PCT_MIN_ALTURA_PX = 18;

function EtiquetaPorcentaje(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  // El content de LabelList no recibe "payload" (recharts lo descarta al
  // filtrar props a solo atributos SVG), así que el flag "es Arana
  // Premium" viaja empaquetado dentro de "value" (ver valueAccessor más
  // abajo), que sí llega intacto.
  value?: string | number | boolean | null;
  tipo: string;
}) {
  const { x, y, width, height, value, tipo } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  const [pctTexto, flagAranaPremium] = String(value ?? "").split("|");
  const pct = Number(pctTexto);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const alturaBarra = Number(height);
  const cx = Number(x) + Number(width) / 2;
  const cy = Number(y) + alturaBarra - 6;
  // Pedido explícito: el % de Premium en Arana siempre en blanco (aunque
  // la barra sea corta); Convencional de Arana sigue la regla general.
  const color =
    flagAranaPremium === "1" ? "#fff" : tipo === "CONVENCIONAL" || alturaBarra < PCT_MIN_ALTURA_PX ? "#000" : "#fff";
  return (
    <text x={cx} y={cy} textAnchor="middle" fontSize={12} fill={color}>
      {pct.toFixed(0)}%
    </text>
  );
}

// Tooltip a medida: kg real, % y PU CIF de cada tipo (viajan junto al
// punto como "<tipo>__pct"/"__pu").
function ContenidoTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload as Punto | undefined;
  const entradas = payload.filter((p) => Number(p.value) > 0);
  if (!fila || entradas.length === 0) return null;

  return (
    <div className="rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {entradas.map((p) => {
        const tipo = String(p.dataKey);
        const pct = fila[`${tipo}__pct`];
        const pu = fila[`${tipo}__pu`];
        return (
          <p key={tipo} style={{ color: p.color }}>
            {ETIQUETA_TIPO[tipo] ?? tipo}: {formatCantidad(Number(p.value))} Kg
            {typeof pct === "number" ? ` (${pct.toFixed(0)}%)` : ""}
            {typeof pu === "number" ? ` · PU CIF Fact.: ${formatMoneda(pu, "USD")}` : ""}
          </p>
        );
      })}
    </div>
  );
}

// Kg exportados por variedad, con una barra de Premium y otra de
// Convencional al lado (no apiladas) — el % de cada una sobre el total
// de kg de esa variedad va dentro de la barra, y encima de cada barra
// salen sus kg y su PU CIF facturado. Datos ya calculados por
// calcularExportacionesPorVariedadYTipo (lib/facturacion-exportacion.ts).
export function VariedadTipoChart({ titulo, datos }: { titulo: string; datos: FilaVariedadTipo[] }) {
  const puntos: Punto[] = datos.map((f) => {
    const punto: Punto = { variedad: f.variedad, totalKg: f.totalKg };
    for (const s of f.porTipo) {
      punto[s.tipo] = s.kg;
      punto[`${s.tipo}__pct`] = s.pct;
      punto[`${s.tipo}__pu`] = s.puCifFacturado;
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
                <Legend formatter={(value) => ETIQUETA_TIPO[value] ?? value} />
                {TIPOS.map((tipo, i) => (
                  <Bar key={tipo} dataKey={tipo} fill={colorPara(tipo, i)}>
                    <LabelList dataKey={tipo} content={(props) => <EtiquetaKg {...props} />} />
                    <LabelList dataKey={`${tipo}__pu`} content={(props) => <EtiquetaPU {...props} />} />
                    <LabelList
                      valueAccessor={(entry: { payload?: Punto }) => {
                        const pct = entry.payload?.[`${tipo}__pct`];
                        const esAranaPremium = tipo === "PREMIUM" && entry.payload?.variedad === "ARANA";
                        return `${typeof pct === "number" ? pct : 0}|${esAranaPremium ? "1" : "0"}`;
                      }}
                      content={(props) => <EtiquetaPorcentaje {...props} tipo={tipo} />}
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
