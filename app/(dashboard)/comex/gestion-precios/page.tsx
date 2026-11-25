import { Search, Tag } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatCantidad } from "@/lib/utils";
import { normalizarShipNumber } from "@/lib/comex/registro-rechazos";
import { NuevoPrecioForm } from "./nuevo-precio-form";
import { PrecioRow } from "./precio-row";
import { VincularEmbarqueForm } from "./vincular-embarque-form";

export default async function GestionPreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ po?: string }>;
}) {
  const { po } = await searchParams;
  const termino = po?.trim();

  let lineasBilling: { variety: string; format: string; label: string; netWeight: unknown; embarqueId: string | null; embarqueVinculadoPor: string | null }[] = [];
  let lineasPallets: { variedad: string; descripcionSku: string | null; cases: number; pesoNetoKg: unknown }[] = [];
  let embarqueId: string | null = null;
  let embarqueVinculadoPor: string | null = null;
  let embarqueVinculado: { id: string; numero: string; shipNumber: string | null } | null = null;
  let precios: Awaited<ReturnType<typeof buscarPrecios>> = [];

  if (termino) {
    lineasBilling = await prisma.historicalBilling.findMany({
      where: { po: termino },
      select: { variety: true, format: true, label: true, netWeight: true, embarqueId: true, embarqueVinculadoPor: true },
    });

    // Se respeta el enlace YA GUARDADO en HistoricalBilling (automático en
    // la migración, o manual — ver vincularEmbarqueFacturacionAction) en
    // vez de volver a adivinarlo por Ship Number en cada visita. Solo si
    // ninguna línea de Facturación tiene enlace se intenta un match en
    // vivo (ej. un PO que todavía no está en Facturación pero sí como
    // embarque importado por Importar PL).
    const embarqueIdGuardado = lineasBilling.find((l) => l.embarqueId)?.embarqueId ?? null;
    if (embarqueIdGuardado) {
      embarqueId = embarqueIdGuardado;
      embarqueVinculadoPor = lineasBilling.find((l) => l.embarqueId)?.embarqueVinculadoPor ?? null;
    } else if (lineasBilling.length === 0) {
      const embarquesConShip = await prisma.embarque.findMany({
        where: { shipNumber: { not: null } },
        select: { id: true, shipNumber: true, numero: true },
      });
      const normalizado = normalizarShipNumber(termino);
      const embarque = embarquesConShip.find(
        (e) => (e.shipNumber && normalizarShipNumber(e.shipNumber) === normalizado) || normalizarShipNumber(e.numero) === normalizado
      );
      embarqueId = embarque?.id ?? null;
    }

    if (embarqueId) {
      lineasPallets = await prisma.embarquePallet.findMany({
        where: { embarqueId },
        select: { variedad: true, descripcionSku: true, cases: true, pesoNetoKg: true },
      });
      embarqueVinculado = await prisma.embarque.findUnique({ where: { id: embarqueId }, select: { id: true, numero: true, shipNumber: true } });
    }

    precios = await buscarPrecios(termino, embarqueId);
  }

  const totalKgBilling = lineasBilling.reduce((acc, l) => acc + Number(l.netWeight), 0);
  const totalKgPallets = lineasPallets.reduce((acc, l) => acc + Number(l.pesoNetoKg), 0);
  const totalCajasPallets = lineasPallets.reduce((acc, l) => acc + l.cases, 0);
  const totalKg = totalKgPallets > 0 ? totalKgPallets : totalKgBilling;
  const totalCajas = totalCajasPallets > 0 ? totalCajasPallets : null;

  return (
    <div>
      <PageHeader
        titulo="Gestión de Precios"
        descripcion="Busca un PO, consulta sus productos/cantidades y registra precios unitarios para valorizar la exportación. Permite más de un precio por PO/producto — nunca se asume que un producto tiene siempre el mismo precio."
      />

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid min-w-[260px] flex-1 gap-1.5">
          <Label htmlFor="po">PO / Ship Number</Label>
          <Input id="po" name="po" placeholder="Ej. DEPE026-0319" defaultValue={po ?? ""} />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </form>

      {!termino ? (
        <EmptyState icono={Tag} titulo="Busca un PO para empezar" descripcion="Escribe el PO (o Ship Number) arriba y presiona Buscar." />
      ) : lineasBilling.length === 0 && lineasPallets.length === 0 ? (
        <EmptyState
          icono={Tag}
          titulo="No se encontró ese PO"
          descripcion="Revisa que el PO exista en Facturación (Importar Facturación) o en un embarque importado (Importar PL)."
        />
      ) : (
        <div className="space-y-6">
          {lineasBilling.length > 0 && (
            <VincularEmbarqueForm
              po={termino}
              embarqueVinculado={embarqueVinculado}
              embarqueVinculadoPor={embarqueVinculadoPor as "AUTOMATICO" | "MANUAL" | null}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productos y cantidades — {termino}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Dato etiqueta="Kg (Facturación)" valor={totalKgBilling > 0 ? `${formatCantidad(totalKgBilling)} Kg` : "—"} />
                <Dato etiqueta="Cajas (Packing List)" valor={totalCajasPallets > 0 ? formatCantidad(totalCajasPallets) : "—"} />
                <Dato etiqueta="Kg (Packing List)" valor={totalKgPallets > 0 ? `${formatCantidad(totalKgPallets)} Kg` : "—"} />
              </div>

              {lineasPallets.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variedad</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead numeric>Cajas</TableHead>
                      <TableHead numeric>Kg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineasPallets.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.variedad}</TableCell>
                        <TableCell>{l.descripcionSku ?? "—"}</TableCell>
                        <TableCell numeric>{formatCantidad(l.cases)}</TableCell>
                        <TableCell numeric>{formatCantidad(Number(l.pesoNetoKg))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {lineasBilling.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variedad</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead numeric>Kg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineasBilling.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.variety}</TableCell>
                        <TableCell>{l.format}</TableCell>
                        <TableCell>{l.label}</TableCell>
                        <TableCell numeric>{formatCantidad(Number(l.netWeight))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Precios registrados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {precios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay precios registrados para este PO.</p>
              ) : (
                precios.map((p) => (
                  <PrecioRow
                    key={p.id}
                    precio={{
                      id: p.id,
                      productoSku: p.productoSku,
                      variedad: p.variedad,
                      precioUnitario: Number(p.precioUnitario),
                      moneda: p.moneda,
                      unidad: p.unidad,
                      incoterm: p.incoterm,
                      tipoPrecio: p.tipoPrecio,
                      createdAt: p.createdAt,
                      historial: p.historial.map((h) => ({
                        id: h.id,
                        precioAnterior: Number(h.precioAnterior),
                        precioNuevo: Number(h.precioNuevo),
                        createdAt: h.createdAt,
                      })),
                    }}
                    cantidades={{ totalKg: totalKg > 0 ? totalKg : null, totalCajas }}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar nuevo precio</CardTitle>
            </CardHeader>
            <CardContent>
              <NuevoPrecioForm po={termino} embarqueId={embarqueId} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function buscarPrecios(po: string, embarqueId: string | null) {
  return prisma.priceRecord.findMany({
    where: embarqueId ? { OR: [{ po }, { embarqueId }] } : { po },
    include: { historial: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}
