import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { cn, formatDate, rangoFechaCosecha, semanaISO } from "@/lib/utils";

// Una fila por combinación (fecha de cosecha, variedad). "Aprovechable" es
// el Exportable registrado en Ingreso de Materia Prima neto de lo que ese
// mismo lote terminó como Descarte Planta en Ingreso IQF (fruta que se creía
// exportable pero se descartó recién en planta). Por eso:
//   Total Recepcionado = Aprovechable + Nacional Campo + Nacional Planta
//                       = (Exportable - Nacional Planta) + Nacional Campo + Nacional Planta
//                       = Exportable + Nacional Campo
// que es exactamente el total registrado en Ingreso de Materia Prima,
// sin importar cuánto se haya descartado después en planta.
type Fila = {
  fechaCosecha: Date;
  variedad: string;
  exportableCampo: number;
  nacionalCampo: number;
  nacionalPlanta: number;
};

function formatNumero(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPorcentaje(n: number) {
  return `${n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default async function ReporteAcopioPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const fechaCosecha = rangoFechaCosecha(desde, hasta);

  const [lineasFruta, lineasIQF] = await Promise.all([
    prisma.ingresoFrutaPallet.findMany({
      where: fechaCosecha ? { ingresoFruta: { fechaCosecha } } : undefined,
      select: {
        variedad: true,
        tipoProducto: true,
        pesoNetoKg: true,
        ingresoFruta: { select: { fechaCosecha: true } },
      },
    }),
    // Solo el descarte de planta "puro" (registrado en Ingreso IQF). El
    // descarte de campo también arma pallets IQF, pero sus líneas viven en
    // ingresoFrutaPallet (con tipoProducto "Descarte Campo"), no acá.
    prisma.ingresoIQFPallet.findMany({
      where: fechaCosecha ? { ingresoIQF: { fechaCosecha } } : undefined,
      select: {
        variedad: true,
        pesoNetoKg: true,
        ingresoIQF: { select: { fechaCosecha: true } },
      },
    }),
  ]);

  const filasPorClave = new Map<string, Fila>();
  function obtenerFila(fecha: Date, variedad: string): Fila {
    const clave = `${fecha.toISOString()}|${variedad}`;
    let fila = filasPorClave.get(clave);
    if (!fila) {
      fila = { fechaCosecha: fecha, variedad, exportableCampo: 0, nacionalCampo: 0, nacionalPlanta: 0 };
      filasPorClave.set(clave, fila);
    }
    return fila;
  }

  for (const linea of lineasFruta) {
    const fila = obtenerFila(linea.ingresoFruta.fechaCosecha, linea.variedad);
    const neto = Number(linea.pesoNetoKg);
    if (linea.tipoProducto === "Exportable") {
      fila.exportableCampo += neto;
    } else if (linea.tipoProducto === "Descarte Campo") {
      fila.nacionalCampo += neto;
    }
  }
  for (const linea of lineasIQF) {
    const fila = obtenerFila(linea.ingresoIQF.fechaCosecha, linea.variedad);
    fila.nacionalPlanta += Number(linea.pesoNetoKg);
  }

  const filasCalculadas = Array.from(filasPorClave.values())
    .map((f) => {
      const aprovechable = f.exportableCampo - f.nacionalPlanta;
      const recepcionado = aprovechable + f.nacionalCampo + f.nacionalPlanta;
      const pctNacional = recepcionado > 0 ? ((f.nacionalCampo + f.nacionalPlanta) / recepcionado) * 100 : 0;
      return {
        semana: semanaISO(f.fechaCosecha),
        fechaCosecha: f.fechaCosecha,
        variedad: f.variedad,
        aprovechable,
        nacionalCampo: f.nacionalCampo,
        nacionalPlanta: f.nacionalPlanta,
        recepcionado,
        pctNacional,
      };
    })
    .sort(
      (a, b) => a.fechaCosecha.getTime() - b.fechaCosecha.getTime() || a.variedad.localeCompare(b.variedad)
    );

  type FilaTabla =
    | ({ tipo: "dato" } & (typeof filasCalculadas)[number])
    | {
        tipo: "subtotal";
        semana: number;
        aprovechable: number;
        nacionalCampo: number;
        nacionalPlanta: number;
        recepcionado: number;
        pctNacional: number;
      };

  const filasTabla: FilaTabla[] = [];
  let semanaActual: number | null = null;
  let acumulado = { aprovechable: 0, nacionalCampo: 0, nacionalPlanta: 0, recepcionado: 0 };

  function empujarSubtotal(semana: number) {
    filasTabla.push({
      tipo: "subtotal",
      semana,
      ...acumulado,
      pctNacional:
        acumulado.recepcionado > 0
          ? ((acumulado.nacionalCampo + acumulado.nacionalPlanta) / acumulado.recepcionado) * 100
          : 0,
    });
    acumulado = { aprovechable: 0, nacionalCampo: 0, nacionalPlanta: 0, recepcionado: 0 };
  }

  for (const fila of filasCalculadas) {
    if (semanaActual !== null && fila.semana !== semanaActual) {
      empujarSubtotal(semanaActual);
    }
    semanaActual = fila.semana;
    acumulado.aprovechable += fila.aprovechable;
    acumulado.nacionalCampo += fila.nacionalCampo;
    acumulado.nacionalPlanta += fila.nacionalPlanta;
    acumulado.recepcionado += fila.recepcionado;
    filasTabla.push({ tipo: "dato", ...fila });
  }
  if (semanaActual !== null) {
    empujarSubtotal(semanaActual);
  }

  const totalGeneral = filasCalculadas.reduce(
    (acc, f) => ({
      aprovechable: acc.aprovechable + f.aprovechable,
      nacionalCampo: acc.nacionalCampo + f.nacionalCampo,
      nacionalPlanta: acc.nacionalPlanta + f.nacionalPlanta,
      recepcionado: acc.recepcionado + f.recepcionado,
    }),
    { aprovechable: 0, nacionalCampo: 0, nacionalPlanta: 0, recepcionado: 0 }
  );
  const pctNacionalTotal =
    totalGeneral.recepcionado > 0
      ? ((totalGeneral.nacionalCampo + totalGeneral.nacionalPlanta) / totalGeneral.recepcionado) * 100
      : 0;

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
        descripcion="Resumen de volumen aprovechable y nacional por variedad y semana de cosecha. Aprovechable = Exportable de Ingreso de Materia Prima menos lo que terminó como Descarte Planta. Nacional Campo y Nacional Planta son el descarte de campo y de planta respectivamente. Recepcionado = Aprovechable + Nacional Campo + Nacional Planta, y coincide con el total de Ingreso de Materia Prima."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
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
        {(desde || hasta) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/reporte">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {filasCalculadas.length === 0 ? (
        <EmptyState
          icono={BarChart3}
          titulo="Todavía no hay datos para mostrar"
          descripcion="Registra ingresos en Ingreso de Materia Prima (y, si corresponde, en Ingreso IQF) para ver el resumen acá."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>F. Cosecha</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead className="text-right">Kg Recepcionado</TableHead>
                <TableHead className="text-right">Kg Aprovechable</TableHead>
                <TableHead className="text-right">Kg Nacional Campo</TableHead>
                <TableHead className="text-right">Kg Nacional Planta</TableHead>
                <TableHead className="text-right">% Nacional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasTabla.map((fila, index) =>
                fila.tipo === "subtotal" ? (
                  <TableRow key={`subtotal-${fila.semana}-${index}`} className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>Total semana {fila.semana}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.recepcionado)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.aprovechable)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.nacionalCampo)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.nacionalPlanta)}</TableCell>
                    <TableCell className="text-right">{formatPorcentaje(fila.pctNacional)}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={`${fila.fechaCosecha.toISOString()}-${fila.variedad}`}>
                    <TableCell className={cn("text-muted-foreground")}>{fila.semana}</TableCell>
                    <TableCell>{formatDate(fila.fechaCosecha)}</TableCell>
                    <TableCell className="font-medium">{fila.variedad}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.recepcionado)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.aprovechable)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.nacionalCampo)}</TableCell>
                    <TableCell className="text-right">{formatNumero(fila.nacionalPlanta)}</TableCell>
                    <TableCell className="text-right">{formatPorcentaje(fila.pctNacional)}</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap justify-end gap-6 border-t pt-4 text-sm">
            <p>
              Total recepcionado: <span className="font-medium">{formatNumero(totalGeneral.recepcionado)} kg</span>
            </p>
            <p>
              Total aprovechable: <span className="font-medium">{formatNumero(totalGeneral.aprovechable)} kg</span>
            </p>
            <p>
              Total nacional campo: <span className="font-medium">{formatNumero(totalGeneral.nacionalCampo)} kg</span>
            </p>
            <p>
              Total nacional planta: <span className="font-medium">{formatNumero(totalGeneral.nacionalPlanta)} kg</span>
            </p>
            <p className="text-base">
              % Nacional: <span className="font-semibold text-primary">{formatPorcentaje(pctNacionalTotal)}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
