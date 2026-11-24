import Link from "next/link";
import { Download, Receipt, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroRangoFecha } from "@/components/shared/filtro-rango-fecha";
import { calcularResumenLiquidaciones } from "@/lib/comex/resumen-liquidaciones";
import { formatCantidad } from "@/lib/utils";

export default async function ResumenLiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;

  const filas = await calcularResumenLiquidaciones({
    desde: desde ? new Date(desde) : undefined,
    hasta: hasta ? new Date(hasta) : undefined,
  });

  const totales = filas.reduce(
    (acc, f) => ({
      despachadas: acc.despachadas + f.cajasDespachadas,
      buenas: acc.buenas + f.cajasBuenas,
      rechazadas: acc.rechazadas + f.cajasRechazadasConfirmadas,
      terminalMarket: acc.terminalMarket + f.cajasTerminalMarket,
      nonFresh: acc.nonFresh + f.cajasNonFresh,
      otro: acc.otro + f.cajasOtro,
    }),
    { despachadas: 0, buenas: 0, rechazadas: 0, terminalMarket: 0, nonFresh: 0, otro: 0 }
  );
  const pctRechazoTotal = totales.despachadas > 0 ? (totales.rechazadas / totales.despachadas) * 100 : 0;

  const queryExcel = new URLSearchParams();
  if (desde) queryExcel.set("desde", desde);
  if (hasta) queryExcel.set("hasta", hasta);

  return (
    <div>
      <PageHeader
        titulo="Resumen de Liquidaciones"
        descripcion="Cajas despachadas, buenas y rechazadas (solo rechazos ya confirmados, nunca los sugeridos) por Ship Number/PO/Variedad/SKU/LPN/Pallet."
        acciones={
          <Button variant="outline" asChild>
            <Link href={`/api/excel/resumen-liquidaciones${queryExcel.toString() ? `?${queryExcel.toString()}` : ""}`}>
              <Download className="mr-2 h-4 w-4" />
              Exportar a Excel
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <FiltroRangoFecha desde={desde ?? ""} hasta={hasta ?? ""} label="Fecha de importación del embarque" />
        <Button type="submit" variant="secondary">
          <Search className="mr-2 h-4 w-4" />
          Aplicar
        </Button>
      </form>

      {filas.length === 0 ? (
        <EmptyState
          icono={Receipt}
          titulo="Sin datos para este filtro"
          descripcion="Importa un Packing List en Importar PL para ver el resumen acá."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ship Number</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Pallet</TableHead>
              <TableHead>LPN</TableHead>
              <TableHead>Variedad</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead numeric>Despachadas</TableHead>
              <TableHead numeric>Buenas</TableHead>
              <TableHead numeric>Rechazadas</TableHead>
              <TableHead numeric>Terminal Market</TableHead>
              <TableHead numeric>Non-Fresh</TableHead>
              <TableHead numeric>Otros</TableHead>
              <TableHead numeric>% Rechazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f, i) => (
              <TableRow key={`${f.palletNumber}-${f.lpn}-${i}`}>
                <TableCell>{f.shipNumber}</TableCell>
                <TableCell>{f.po ?? "—"}</TableCell>
                <TableCell className="font-mono">{f.palletNumber}</TableCell>
                <TableCell className="font-mono">{f.lpn ?? "—"}</TableCell>
                <TableCell>{f.variedad}</TableCell>
                <TableCell>{f.descripcionSku ?? "—"}</TableCell>
                <TableCell numeric>{formatCantidad(f.cajasDespachadas)}</TableCell>
                <TableCell numeric>{formatCantidad(f.cajasBuenas)}</TableCell>
                <TableCell numeric>{formatCantidad(f.cajasRechazadasConfirmadas)}</TableCell>
                <TableCell numeric>{formatCantidad(f.cajasTerminalMarket)}</TableCell>
                <TableCell numeric>{formatCantidad(f.cajasNonFresh)}</TableCell>
                <TableCell numeric>{formatCantidad(f.cajasOtro)}</TableCell>
                <TableCell numeric>{f.pctRechazo.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={6}>TOTAL</TableCell>
              <TableCell numeric>{formatCantidad(totales.despachadas)}</TableCell>
              <TableCell numeric>{formatCantidad(totales.buenas)}</TableCell>
              <TableCell numeric>{formatCantidad(totales.rechazadas)}</TableCell>
              <TableCell numeric>{formatCantidad(totales.terminalMarket)}</TableCell>
              <TableCell numeric>{formatCantidad(totales.nonFresh)}</TableCell>
              <TableCell numeric>{formatCantidad(totales.otro)}</TableCell>
              <TableCell numeric>{pctRechazoTotal.toFixed(1)}%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
