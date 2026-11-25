import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitCompare } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { aFilaFacturacion, SELECT_SUBCONJUNTO_TIPADO } from "@/lib/comex/mapeo-facturacion";
import { compararKpis, compararRegistros } from "@/lib/comex/conciliacion-facturacion";

// Fase 7 del plan "COMEX: Base de datos centralizada de Exportaciones" —
// comprueba que la migración histórica (HistoricalBilling) conserva
// exactamente los mismos resultados que el dashboard original
// (facturacion_exportacion), usando el mismo motor de cálculo
// (lib/facturacion-exportacion.ts) sobre ambas fuentes.
export default async function ConciliacionExcelSupabasePage() {
  const [filasExcelRaw, filasSupabaseRaw] = await Promise.all([
    prisma.facturacionExportacion.findMany({ select: SELECT_SUBCONJUNTO_TIPADO }),
    prisma.historicalBilling.findMany({ select: SELECT_SUBCONJUNTO_TIPADO }),
  ]);
  const filasExcel = filasExcelRaw.map(aFilaFacturacion);
  const filasSupabase = filasSupabaseRaw.map(aFilaFacturacion);

  if (filasExcel.length === 0 && filasSupabase.length === 0) {
    return (
      <div>
        <PageHeader titulo="Conciliación Excel vs Supabase" />
        <EmptyState
          icono={GitCompare}
          titulo="No hay datos para conciliar"
          descripcion="Sincroniza facturacion_exportacion y/o corre la migración en Importar Facturación."
        />
      </div>
    );
  }

  const kpis = compararKpis(filasExcel, filasSupabase);
  const registros = compararRegistros(filasExcel, filasSupabase);

  return (
    <div>
      <PageHeader
        titulo="Conciliación Excel vs Supabase"
        descripcion="Compara el Dashboard Exportaciones original (facturacion_exportacion) contra la migración histórica (HistoricalBilling) con el mismo motor de cálculo, para comprobar que los números no cambiaron."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Indicadores</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Solo se comparan los indicadores que ya calcula el dashboard (el Excel trae ~109 columnas más — fletes, seguros, notas de
            crédito/débito, anticipos — que facturacion_exportacion nunca capturó; están preservadas en HistoricalBilling.datosOriginales,
            pero no hay un valor confiable del lado Excel contra el cual compararlas todavía).
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead numeric>Excel (facturacion_exportacion)</TableHead>
                <TableHead numeric>Supabase (HistoricalBilling)</TableHead>
                <TableHead numeric>Diferencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((k) => (
                <TableRow key={k.indicador}>
                  <TableCell className="font-medium">{k.indicador}</TableCell>
                  <TableCell numeric>{formatearValor(k.excel, k.formato)}</TableCell>
                  <TableCell numeric>{formatearValor(k.supabase, k.formato)}</TableCell>
                  <TableCell numeric>{formatearValor(k.diferencia, k.formato)}</TableCell>
                  <TableCell>
                    <Badge variant={k.estado === "COINCIDE" ? "success" : "destructive"}>
                      {k.estado === "COINCIDE" ? "Coincide" : "Diferencia detectada"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conciliación por registro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Emparejado por PO + fecha + cliente + variedad + formato + etiqueta + kg (facturacion_exportacion no guarda el número de fila
            original del Excel, así que no hay una llave 1:1 perfecta) — una fila sin match exacto queda listada abajo, nunca se asume a
            cuál le corresponde.
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Dato etiqueta="Filas en Excel" valor={formatCantidad(registros.totalExcel)} />
            <Dato etiqueta="Filas en Supabase" valor={formatCantidad(registros.totalSupabase)} />
            <Dato etiqueta="Coincidencias exactas" valor={formatCantidad(registros.coincidencias)} />
          </div>

          {registros.diferencias.length === 0 ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              Todas las filas tienen una coincidencia exacta entre ambas fuentes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Llave (PO · fecha · cliente · variedad · formato · etiqueta · kg)</TableHead>
                  <TableHead>En Excel sin match</TableHead>
                  <TableHead>En Supabase sin match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.diferencias.map((d) => (
                  <TableRow key={d.clave}>
                    <TableCell className="font-mono text-xs">{d.clave}</TableCell>
                    <TableCell>{d.enExcelSinMatch ? <Badge variant="destructive">Sí</Badge> : "—"}</TableCell>
                    <TableCell>{d.enSupabaseSinMatch ? <Badge variant="destructive">Sí</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatearValor(valor: number, formato: "entero" | "kg" | "moneda"): string {
  if (formato === "moneda") return formatMoneda(valor, "USD");
  if (formato === "kg") return `${formatCantidad(valor)} Kg`;
  return formatCantidad(valor);
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}
