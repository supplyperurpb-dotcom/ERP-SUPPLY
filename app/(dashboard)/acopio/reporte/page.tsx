import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SummaryCard } from "@/components/ui/cards/summary-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { cn, rangoFechaCosecha, rangoSemanaISO, semanaISOConAnio } from "@/lib/utils";

// Una fila por combinación (año ISO, semana ISO, variedad): se acumulan
// todas las fechas de cosecha de esa semana en una sola fila (no se
// desglosa por fecha exacta), siempre dentro de los filtros elegidos.
// "Aprovechable" es todo lo registrado como "Exportable" en Ingreso de
// Materia Prima, tal cual (sin restarle nada). "Nacional Campo" es todo lo
// que NO es exportable: las líneas "Descarte Campo" de Ingreso de Materia
// Prima más todo lo registrado en Ingreso Industrial Planta (que en este fundo también es
// descarte de campo, no de planta). Por eso:
//   Total Recepcionado = Aprovechable + Nacional Campo
// y nunca da negativo, porque ningún término se resta.
type Fila = {
  anio: number;
  semana: number;
  variedad: string;
  aprovechable: number;
  nacionalCampo: number;
};

function formatNumero(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPorcentaje(n: number) {
  return `${n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Igual formato que el "PESO NETO (KG)" del reporte de Excel (2 decimales
// fijos), sin el sufijo "kg" que agrega formatKg — la columna ya lo dice.
function formatKgDosDecimales(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ReporteAcopioPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; semana?: string }>;
}) {
  const { desde, hasta, semana: semanaParam } = await searchParams;

  let fechaCosecha = rangoFechaCosecha(desde, hasta);
  const [anioFiltro, semanaFiltro] = (semanaParam ?? "").split("-").map(Number);
  if (semanaParam && Number.isFinite(anioFiltro) && Number.isFinite(semanaFiltro)) {
    const rangoSemana = rangoSemanaISO(anioFiltro, semanaFiltro);
    fechaCosecha = {
      gte: fechaCosecha?.gte && fechaCosecha.gte > rangoSemana.gte ? fechaCosecha.gte : rangoSemana.gte,
      lte: fechaCosecha?.lte && fechaCosecha.lte < rangoSemana.lte ? fechaCosecha.lte : rangoSemana.lte,
    };
  }

  const [lineasFruta, lineasIndustrial, fechasFruta, fechasIndustrial] = await Promise.all([
    prisma.ingresoFrutaPallet.findMany({
      where: fechaCosecha ? { ingresoFruta: { fechaCosecha } } : undefined,
      select: {
        variedad: true,
        modulo: true,
        turno: true,
        tipoProducto: true,
        pesoNetoKg: true,
        cantidadBandejas: true,
        ingresoFruta: { select: { fechaCosecha: true, placaTransporte: true, horaIngreso: true } },
      },
    }),
    // Todo lo registrado en Ingreso Industrial Planta cuenta como Nacional Campo (ver
    // comentario arriba: acá no se distingue descarte de planta). No tiene
    // módulo/turno (ese desglose es solo de campo) — sale "—" en esa tabla.
    prisma.ingresoIndustrialPallet.findMany({
      where: fechaCosecha ? { fechaCosecha } : undefined,
      select: {
        variedad: true,
        pesoNetoKg: true,
        cantidadBandejas: true,
        fechaCosecha: true,
      },
    }),
    // Universo completo de fechas de cosecha (sin aplicar el filtro actual)
    // para que el desplegable de semanas siempre muestre todas las semanas
    // con datos, no solo las del filtro ya aplicado.
    prisma.ingresoFruta.findMany({ select: { fechaCosecha: true }, distinct: ["fechaCosecha"] }),
    prisma.ingresoIndustrialPallet.findMany({ select: { fechaCosecha: true }, distinct: ["fechaCosecha"] }),
  ]);

  const semanasDisponiblesMap = new Map<string, { anio: number; semana: number }>();
  for (const { fechaCosecha: f } of [...fechasFruta, ...fechasIndustrial]) {
    const { anio, semana } = semanaISOConAnio(f);
    semanasDisponiblesMap.set(`${anio}-${semana}`, { anio, semana });
  }
  const semanasDisponibles = Array.from(semanasDisponiblesMap.entries())
    .map(([valor, datos]) => ({ valor, ...datos }))
    .sort((a, b) => a.anio - b.anio || a.semana - b.semana);
  const mostrarAnio = new Set(semanasDisponibles.map((s) => s.anio)).size > 1;

  const filasPorClave = new Map<string, Fila>();
  function obtenerFila(fecha: Date, variedad: string): Fila {
    const { anio, semana } = semanaISOConAnio(fecha);
    const clave = `${anio}-${semana}|${variedad}`;
    let fila = filasPorClave.get(clave);
    if (!fila) {
      fila = { anio, semana, variedad, aprovechable: 0, nacionalCampo: 0 };
      filasPorClave.set(clave, fila);
    }
    return fila;
  }

  for (const linea of lineasFruta) {
    const fila = obtenerFila(linea.ingresoFruta.fechaCosecha, linea.variedad);
    const neto = Number(linea.pesoNetoKg);
    if (linea.tipoProducto === "Exportable") {
      fila.aprovechable += neto;
    } else if (linea.tipoProducto === "Descarte Campo") {
      fila.nacionalCampo += neto;
    }
  }
  for (const linea of lineasIndustrial) {
    const fila = obtenerFila(linea.fechaCosecha, linea.variedad);
    fila.nacionalCampo += Number(linea.pesoNetoKg);
  }

  const filasCalculadas = Array.from(filasPorClave.values())
    .map((f) => {
      const recepcionado = f.aprovechable + f.nacionalCampo;
      const pctNacional = recepcionado > 0 ? (f.nacionalCampo / recepcionado) * 100 : 0;
      return {
        anio: f.anio,
        semana: f.semana,
        variedad: f.variedad,
        aprovechable: f.aprovechable,
        nacionalCampo: f.nacionalCampo,
        recepcionado,
        pctNacional,
      };
    })
    .sort((a, b) => a.anio - b.anio || a.semana - b.semana || a.variedad.localeCompare(b.variedad));

  type FilaTabla =
    | ({ tipo: "dato" } & (typeof filasCalculadas)[number])
    | {
        tipo: "subtotal";
        anio: number;
        semana: number;
        aprovechable: number;
        nacionalCampo: number;
        recepcionado: number;
        pctNacional: number;
      };

  const filasTabla: FilaTabla[] = [];
  let claveSemanaActual: string | null = null;
  let semanaActual = { anio: 0, semana: 0 };
  let acumulado = { aprovechable: 0, nacionalCampo: 0, recepcionado: 0 };

  function empujarSubtotal() {
    filasTabla.push({
      tipo: "subtotal",
      anio: semanaActual.anio,
      semana: semanaActual.semana,
      ...acumulado,
      pctNacional: acumulado.recepcionado > 0 ? (acumulado.nacionalCampo / acumulado.recepcionado) * 100 : 0,
    });
    acumulado = { aprovechable: 0, nacionalCampo: 0, recepcionado: 0 };
  }

  for (const fila of filasCalculadas) {
    const clave = `${fila.anio}-${fila.semana}`;
    if (claveSemanaActual !== null && clave !== claveSemanaActual) {
      empujarSubtotal();
    }
    claveSemanaActual = clave;
    semanaActual = { anio: fila.anio, semana: fila.semana };
    acumulado.aprovechable += fila.aprovechable;
    acumulado.nacionalCampo += fila.nacionalCampo;
    acumulado.recepcionado += fila.recepcionado;
    filasTabla.push({ tipo: "dato", ...fila });
  }
  if (claveSemanaActual !== null) {
    empujarSubtotal();
  }

  const totalGeneral = filasCalculadas.reduce(
    (acc, f) => ({
      aprovechable: acc.aprovechable + f.aprovechable,
      nacionalCampo: acc.nacionalCampo + f.nacionalCampo,
      recepcionado: acc.recepcionado + f.recepcionado,
    }),
    { aprovechable: 0, nacionalCampo: 0, recepcionado: 0 }
  );
  const pctNacionalTotal = totalGeneral.recepcionado > 0 ? (totalGeneral.nacionalCampo / totalGeneral.recepcionado) * 100 : 0;

  // --- "I. Volumen recepcionado de Materia Prima": detalle por viaje
  // (Exportable, a la izquierda) y resumen por variedad/módulo/turno
  // (Nacional Campo, a la derecha) — mismo filtro de fecha de cosecha de
  // arriba. No se muestra N.º de viaje ni de boleta (pedido explícito).
  const filasExportable = lineasFruta
    .filter((l) => l.tipoProducto === "Exportable")
    .map((l) => ({
      semana: semanaISOConAnio(l.ingresoFruta.fechaCosecha).semana,
      anio: semanaISOConAnio(l.ingresoFruta.fechaCosecha).anio,
      placa: l.ingresoFruta.placaTransporte || "—",
      horaRecepcion: l.ingresoFruta.horaIngreso || "—",
      variedad: l.variedad,
      modulo: l.modulo,
      turno: l.turno,
      pesoNetoKg: Number(l.pesoNetoKg),
      cantidadBandejas: l.cantidadBandejas,
    }))
    .sort((a, b) => a.horaRecepcion.localeCompare(b.horaRecepcion));

  const totalExportable = filasExportable.reduce(
    (acc, f) => ({ pesoNetoKg: acc.pesoNetoKg + f.pesoNetoKg, cantidadBandejas: acc.cantidadBandejas + f.cantidadBandejas }),
    { pesoNetoKg: 0, cantidadBandejas: 0 }
  );

  type FilaNacionalCampo = { variedad: string; modulo: string; turno: string; pesoNetoKg: number; cantidadBandejas: number };
  const nacionalCampoPorClave = new Map<string, FilaNacionalCampo>();
  function acumularNacionalCampo(variedad: string, modulo: string, turno: string, pesoNetoKg: number, cantidadBandejas: number) {
    const clave = `${variedad}|${modulo}|${turno}`;
    const fila = nacionalCampoPorClave.get(clave) ?? { variedad, modulo, turno, pesoNetoKg: 0, cantidadBandejas: 0 };
    fila.pesoNetoKg += pesoNetoKg;
    fila.cantidadBandejas += cantidadBandejas;
    nacionalCampoPorClave.set(clave, fila);
  }
  for (const l of lineasFruta) {
    if (l.tipoProducto === "Descarte Campo") {
      acumularNacionalCampo(l.variedad, l.modulo, l.turno, Number(l.pesoNetoKg), l.cantidadBandejas);
    }
  }
  for (const l of lineasIndustrial) {
    // Sin módulo/turno (ver comentario de la consulta más arriba).
    acumularNacionalCampo(l.variedad, "—", "—", Number(l.pesoNetoKg), l.cantidadBandejas);
  }
  const filasNacionalCampo = Array.from(nacionalCampoPorClave.values()).sort(
    (a, b) => a.variedad.localeCompare(b.variedad) || a.modulo.localeCompare(b.modulo) || a.turno.localeCompare(b.turno)
  );
  const totalNacionalCampo = filasNacionalCampo.reduce(
    (acc, f) => ({ pesoNetoKg: acc.pesoNetoKg + f.pesoNetoKg, cantidadBandejas: acc.cantidadBandejas + f.cantidadBandejas }),
    { pesoNetoKg: 0, cantidadBandejas: 0 }
  );

  const hayFiltro = Boolean(desde || hasta || semanaParam);

  return (
    <div>
      <Link
        href="/acopio"
        className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver a Acopio
      </Link>

      <PageHeader
        titulo="Reporte de Acopio"
        descripcion="Resumen de volumen aprovechable y nacional por variedad y semana de cosecha. Aprovechable = todo lo registrado como Exportable en Ingreso de Materia Prima. Nacional Campo = Descarte Campo de Materia Prima + todo lo registrado en Ingreso Industrial Planta. Recepcionado = Aprovechable + Nacional Campo."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="semana">Semana de cosecha</Label>
          <select
            id="semana"
            name="semana"
            defaultValue={semanaParam ?? ""}
            className={cn(
              "flex h-10 w-[190px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <option value="">Todas las semanas</option>
            {semanasDisponibles.map((s) => (
              <option key={s.valor} value={s.valor}>
                Semana {s.semana}
                {mostrarAnio ? ` (${s.anio})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="desde">Desde (fecha de cosecha)</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hasta">Hasta (fecha de cosecha)</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-[170px]" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {hayFiltro && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/reporte">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {filasCalculadas.length === 0 ? (
        <EmptyState
          icono={BarChart3}
          titulo="Todavía no hay datos para mostrar"
          descripcion="Registra ingresos en Ingreso de Materia Prima (y, si corresponde, en Ingreso Industrial Planta) para ver el resumen acá."
        />
      ) : (
        <>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead className="text-right">Kg Recepcionado</TableHead>
                <TableHead className="text-right">Kg Aprovechable</TableHead>
                <TableHead className="text-right">Kg Nacional Campo</TableHead>
                <TableHead className="text-right">% Nacional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasTabla.map((fila, index) =>
                fila.tipo === "subtotal" ? (
                  <TableRow key={`subtotal-${fila.anio}-${fila.semana}-${index}`} className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>
                      Total semana {fila.semana}
                      {mostrarAnio ? ` (${fila.anio})` : ""}
                    </TableCell>
                    <TableCell className="text-right">{formatNumero(fila.recepcionado)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.aprovechable)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.nacionalCampo)}</TableCell>
                    <TableCell className="text-right">{formatPorcentaje(fila.pctNacional)}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={`${fila.anio}-${fila.semana}-${fila.variedad}`}>
                    <TableCell className="text-muted-foreground">
                      {fila.semana}
                      {mostrarAnio ? ` (${fila.anio})` : ""}
                    </TableCell>
                    <TableCell className="font-medium">{fila.variedad}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.recepcionado)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.aprovechable)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.nacionalCampo)}</TableCell>
                    <TableCell className="text-right">{formatPorcentaje(fila.pctNacional)}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total recepcionado" value={`${formatNumero(totalGeneral.recepcionado)} kg`} />
            <SummaryCard label="Total aprovechable" value={`${formatNumero(totalGeneral.aprovechable)} kg`} />
            <SummaryCard label="Total nacional campo" value={`${formatNumero(totalGeneral.nacionalCampo)} kg`} />
            <SummaryCard label="% Nacional" value={formatPorcentaje(pctNacionalTotal)} />
          </div>

          <h2 className="mb-3 mt-10 text-base font-semibold tracking-tight">
            I. Volumen recepcionado de Materia Prima
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Tipo de operación: Exportación</p>
              {filasExportable.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos de Exportable en el filtro elegido.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Semana</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Hora de recepción</TableHead>
                        <TableHead>Variedad</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead className="text-right">Peso neto (kg)</TableHead>
                        <TableHead className="text-right">N.º jabas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filasExportable.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">
                            {f.semana}
                            {mostrarAnio ? ` (${f.anio})` : ""}
                          </TableCell>
                          <TableCell className="font-medium">{f.placa}</TableCell>
                          <TableCell>{f.horaRecepcion}</TableCell>
                          <TableCell>{f.variedad}</TableCell>
                          <TableCell>{f.modulo}</TableCell>
                          <TableCell>{f.turno}</TableCell>
                          <TableCell className="text-right">{formatKgDosDecimales(f.pesoNetoKg)}</TableCell>
                          <TableCell className="text-right">{f.cantidadBandejas}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={6}>Total general</TableCell>
                        <TableCell className="text-right">{formatKgDosDecimales(totalExportable.pesoNetoKg)}</TableCell>
                        <TableCell className="text-right">{totalExportable.cantidadBandejas}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Tipo de operación: Nacional Campo</p>
              {filasNacionalCampo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos de Nacional Campo en el filtro elegido.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Variedad</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead className="text-right">Peso neto (kg)</TableHead>
                        <TableHead className="text-right">Total bandejas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filasNacionalCampo.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{f.variedad}</TableCell>
                          <TableCell>{f.modulo}</TableCell>
                          <TableCell>{f.turno}</TableCell>
                          <TableCell className="text-right">{formatKgDosDecimales(f.pesoNetoKg)}</TableCell>
                          <TableCell className="text-right">{f.cantidadBandejas}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3}>Total general</TableCell>
                        <TableCell className="text-right">{formatKgDosDecimales(totalNacionalCampo.pesoNetoKg)}</TableCell>
                        <TableCell className="text-right">{totalNacionalCampo.cantidadBandejas}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
