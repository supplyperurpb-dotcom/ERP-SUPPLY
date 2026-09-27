import Link from "next/link";
import { notFound } from "next/navigation";
import { PackagePlus, ArrowLeftRight, PackageMinus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen } from "@/lib/stock-almacen";
import { formatDateTime, formatMoneda } from "@/lib/utils";

export default async function AlmacenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const almacen = await prisma.almacen.findUnique({ where: { id } });
  if (!almacen) notFound();

  const [stock, ingresos, traslados, consumos] = await Promise.all([
    calcularStockAlmacen(id),
    prisma.ingresoAlmacen.findMany({
      where: { almacenId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { proveedor: true, _count: { select: { items: true } } },
    }),
    prisma.trasladoAlmacen.findMany({
      where: { OR: [{ almacenOrigenId: id }, { almacenDestinoId: id }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { almacenOrigen: true, almacenDestino: true, _count: { select: { items: true } } },
    }),
    prisma.consumoAlmacen.findMany({
      where: { almacenOrigenId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        titulo={almacen.nombre}
        descripcion={`Código ${almacen.codigo}${almacen.ubicacion ? ` · ${almacen.ubicacion}` : ""}`}
        acciones={
          <>
            <Button variant="outline" asChild>
              <Link href={`/logistica/almacenes/ingresos/nuevo?almacenId=${id}`}>
                <PackagePlus className="mr-2 h-4 w-4" />
                Ingreso
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/logistica/almacenes/traslados/nuevo?almacenId=${id}`}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Traslado
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/logistica/almacenes/consumos/nuevo?almacenId=${id}`}>
                <PackageMinus className="mr-2 h-4 w-4" />
                Consumo
              </Link>
            </Button>
          </>
        }
      />

      <section>
        <h2 className="mb-3 text-base font-semibold">Stock actual</h2>
        {stock.length === 0 ? (
          <EmptyState
            icono={PackagePlus}
            titulo="Sin stock registrado"
            descripcion="Registra un ingreso para este almacén y aparecerá aquí."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>U.M.</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unit. ponderado (US$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((fila) => (
                <TableRow key={fila.skuId}>
                  <TableCell className="font-medium">{fila.codigo}</TableCell>
                  <TableCell>{fila.descripcion}</TableCell>
                  <TableCell>{fila.unidadMedida}</TableCell>
                  <TableCell className="text-right">{fila.cantidad.toLocaleString("es-PE")}</TableCell>
                  <TableCell className="text-right">
                    {fila.precioUnitarioPonderado !== null ? formatMoneda(fila.precioUnitarioPonderado, "USD") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Últimos ingresos</h2>
        {ingresos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingresos registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Guía</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingresos.map((ingreso) => (
                <TableRow key={ingreso.id}>
                  <TableCell className="font-medium">{ingreso.numero}</TableCell>
                  <TableCell>{formatDateTime(ingreso.fecha)}</TableCell>
                  <TableCell>{ingreso.proveedor?.razonSocial ?? "—"}</TableCell>
                  <TableCell>{ingreso.guiaRemision ?? "—"}</TableCell>
                  <TableCell className="text-right">{ingreso._count.items}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Últimos traslados</h2>
        {traslados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin traslados registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traslados.map((traslado) => (
                <TableRow key={traslado.id}>
                  <TableCell className="font-medium">{traslado.numero}</TableCell>
                  <TableCell>{formatDateTime(traslado.fecha)}</TableCell>
                  <TableCell>{traslado.almacenOrigen.nombre}</TableCell>
                  <TableCell>{traslado.almacenDestino.nombre}</TableCell>
                  <TableCell className="text-right">{traslado._count.items}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Últimos consumos</h2>
        {consumos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin consumos registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Ítems</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumos.map((consumo) => (
                <TableRow key={consumo.id}>
                  <TableCell className="font-medium">{consumo.numero}</TableCell>
                  <TableCell>{formatDateTime(consumo.fecha)}</TableCell>
                  <TableCell className="text-right">{consumo._count.items}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
