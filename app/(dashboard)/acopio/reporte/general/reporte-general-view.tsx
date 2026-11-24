"use client";

import { Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SectionCard } from "@/components/ui/cards/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COLOR_GRILLA, COLOR_EJE, ESTILO_LEYENDA } from "@/app/(dashboard)/comex/dashboard-exportaciones/colores";

// Misma paleta ya establecida en reporte-acopio-view.tsx (Reporte diario):
// azul para el indicador principal/real. Budget/Oct reusan dos tonos ya
// existentes en PALETA_SOBRIA del dashboard de Exportaciones (gris azulado
// / azul acero), no colores nuevos.
const COLOR_REAL = "#376F96";
const COLOR_BUDGET = "#8C97A8";
const COLOR_OCT = "#5B7A9D";

function formatNumero(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPorcentaje(n: number) {
  return `${n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

type AcumuladoVariedad = { variedad: string; aprovechableKg: number; nacionalKg: number; totalKg: number };
type Rendimiento = { variedad: string; hectareas: number; kgEjec: number; kgProy: number };
type ResumenSemanal = { semana: number; variedad: string; aprovechableKg: number; nacionalKg: number; totalKg: number };
type PresupuestoSemana = { semana: number; kgReal: number; kgBudget: number; kgOct: number; pctAvance: number };

export function ReporteGeneralView({
  acumulado,
  rendimiento,
  hectareasTotal,
  resumenSemanal,
  presupuestoSemanal,
}: {
  acumulado: AcumuladoVariedad[];
  rendimiento: Rendimiento[];
  hectareasTotal: number;
  resumenSemanal: ResumenSemanal[];
  presupuestoSemanal: PresupuestoSemana[];
}) {
  const totalGeneral = acumulado.reduce((acc, f) => acc + f.totalKg, 0);

  const puntosGrafico = presupuestoSemanal.map((f) => ({
    categoria: `W${f.semana}`,
    "Kg Real": f.kgReal,
    "Kg Budget": f.kgBudget,
    "Kg Oct": f.kgOct,
  }));

  return (
    <div className="space-y-6">
      <SectionCard title="Acumulado por variedad" description="Suma de toda la temporada seleccionada.">
        {acumulado.every((f) => f.totalKg === 0) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este año.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-muted/40">Variedad</TableHead>
                  <TableHead numeric className="bg-primary text-primary-foreground">
                    Total Kg
                  </TableHead>
                  <TableHead numeric className="bg-emerald-600 text-white">
                    Kg Aprovechable Campo
                  </TableHead>
                  <TableHead numeric className="bg-muted/40">
                    Kg Nacional
                  </TableHead>
                  <TableHead numeric className="bg-muted/40">
                    % Aprovechable Campo
                  </TableHead>
                  <TableHead numeric className="bg-muted/40">
                    % Nacional
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acumulado.map((f) => (
                  <TableRow key={f.variedad}>
                    <TableCell className="font-medium">{f.variedad}</TableCell>
                    <TableCell numeric className="font-semibold">
                      {formatNumero(f.totalKg)}
                    </TableCell>
                    <TableCell numeric>{formatNumero(f.aprovechableKg)}</TableCell>
                    <TableCell numeric>{formatNumero(f.nacionalKg)}</TableCell>
                    <TableCell numeric>{f.totalKg > 0 ? formatPorcentaje((f.aprovechableKg / f.totalKg) * 100) : "—"}</TableCell>
                    <TableCell numeric>{f.totalKg > 0 ? formatPorcentaje((f.nacionalKg / f.totalKg) * 100) : "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell numeric>{formatNumero(totalGeneral)}</TableCell>
                  <TableCell numeric>{formatNumero(acumulado.reduce((acc, f) => acc + f.aprovechableKg, 0))}</TableCell>
                  <TableCell numeric>{formatNumero(acumulado.reduce((acc, f) => acc + f.nacionalKg, 0))}</TableCell>
                  <TableCell numeric>
                    {totalGeneral > 0
                      ? formatPorcentaje((acumulado.reduce((acc, f) => acc + f.aprovechableKg, 0) / totalGeneral) * 100)
                      : "—"}
                  </TableCell>
                  <TableCell numeric>
                    {totalGeneral > 0
                      ? formatPorcentaje((acumulado.reduce((acc, f) => acc + f.nacionalKg, 0) / totalGeneral) * 100)
                      : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Rendimiento por variedad"
        description="Kg Proy. = lo ya cosechado + lo pendiente por cosechar (KG Oct) de cada semana. Hectáreas desde /acopio/presupuesto."
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Variedad</TableHead>
                <TableHead numeric># Ha</TableHead>
                <TableHead numeric>Kg Proy.</TableHead>
                <TableHead numeric>Kg Ejec.</TableHead>
                <TableHead numeric>Kg/Ha Proy.</TableHead>
                <TableHead numeric>Kg/Ha Ejec.</TableHead>
                <TableHead numeric>% Rep.</TableHead>
                <TableHead numeric>% Avance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rendimiento.map((f) => (
                <TableRow key={f.variedad}>
                  <TableCell className="font-medium">{f.variedad}</TableCell>
                  <TableCell numeric>{formatNumero(f.hectareas)}</TableCell>
                  <TableCell numeric>{formatNumero(f.kgProy)}</TableCell>
                  <TableCell numeric>{formatNumero(f.kgEjec)}</TableCell>
                  <TableCell numeric>{f.hectareas > 0 ? formatNumero(f.kgProy / f.hectareas) : "—"}</TableCell>
                  <TableCell numeric>{f.hectareas > 0 ? formatNumero(f.kgEjec / f.hectareas) : "—"}</TableCell>
                  <TableCell numeric>{hectareasTotal > 0 ? formatPorcentaje((f.hectareas / hectareasTotal) * 100) : "—"}</TableCell>
                  <TableCell numeric>{f.kgProy > 0 ? formatPorcentaje((f.kgEjec / f.kgProy) * 100) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="Resumen semanal aprovechable y nacional por variedad">
        {resumenSemanal.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este año.</p>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/40">
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Variedad</TableHead>
                  <TableHead numeric>Kg Recepcionado</TableHead>
                  <TableHead numeric>Kg Aprovechable Campo</TableHead>
                  <TableHead numeric>Kg Nacional</TableHead>
                  <TableHead numeric>% Nacional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumenSemanal.map((f) => (
                  <TableRow key={`${f.semana}__${f.variedad}`}>
                    <TableCell>W{f.semana}</TableCell>
                    <TableCell className="font-medium">{f.variedad}</TableCell>
                    <TableCell numeric>{formatNumero(f.totalKg)}</TableCell>
                    <TableCell numeric>{formatNumero(f.aprovechableKg)}</TableCell>
                    <TableCell numeric>{formatNumero(f.nacionalKg)}</TableCell>
                    <TableCell numeric>{f.totalKg > 0 ? formatPorcentaje((f.nacionalKg / f.totalKg) * 100) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Kg cosechados vs. presupuesto"
        description="Kg Real = ya cosechado. Kg Budget / Kg Oct desde /acopio/presupuesto."
      >
        {presupuestoSemanal.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este año.</p>
        ) : (
          <>
            <div className="mb-6 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Semana</TableHead>
                    <TableHead numeric>Kg Real</TableHead>
                    <TableHead numeric>Kg Budget</TableHead>
                    <TableHead numeric>Kg Oct</TableHead>
                    <TableHead numeric>% Avance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presupuestoSemanal.map((f) => (
                    <TableRow key={f.semana}>
                      <TableCell>W{f.semana}</TableCell>
                      <TableCell numeric className="font-semibold">
                        {formatNumero(f.kgReal)}
                      </TableCell>
                      <TableCell numeric>{formatNumero(f.kgBudget)}</TableCell>
                      <TableCell numeric>{formatNumero(f.kgOct)}</TableCell>
                      <TableCell numeric>{f.kgOct > 0 ? formatPorcentaje(f.pctAvance) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={puntosGrafico} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRILLA} vertical={false} />
                  <XAxis dataKey="categoria" interval={0} fontSize={13} stroke={COLOR_EJE} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatNumero(Number(v))} fontSize={13} stroke={COLOR_EJE} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => formatNumero(Number(v))} />
                  <Legend wrapperStyle={ESTILO_LEYENDA} />
                  <Area type="monotone" dataKey="Kg Budget" fill={COLOR_BUDGET} stroke={COLOR_BUDGET} fillOpacity={0.25} />
                  <Area type="monotone" dataKey="Kg Oct" fill={COLOR_OCT} stroke={COLOR_OCT} fillOpacity={0.35} />
                  <Bar dataKey="Kg Real" fill={COLOR_REAL} maxBarSize={28} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
