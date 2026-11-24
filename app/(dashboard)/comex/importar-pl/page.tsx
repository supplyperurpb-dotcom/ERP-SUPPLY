import Link from "next/link";
import { FileSpreadsheet, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatCantidad } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export default async function ImportarPLPage({
  searchParams,
}: {
  searchParams: Promise<{ busqueda?: string }>;
}) {
  const { busqueda } = await searchParams;
  const termino = busqueda?.trim();

  // Busca por Ship Number/Contenedor (nivel embarque) o Pallet/Variedad/
  // LPN/Trazabilidad (nivel línea) — pedido explícito.
  const where: Prisma.EmbarqueWhereInput = {
    shipNumber: { not: null },
    ...(termino
      ? {
          OR: [
            { shipNumber: { contains: termino, mode: "insensitive" } },
            { contenedor: { contains: termino, mode: "insensitive" } },
            { numero: { contains: termino, mode: "insensitive" } },
            { pallets: { some: { palletNumber: { contains: termino, mode: "insensitive" } } } },
            { pallets: { some: { variedad: { contains: termino, mode: "insensitive" } } } },
            { pallets: { some: { lpnDriscolls: { contains: termino, mode: "insensitive" } } } },
            { pallets: { some: { trazabilityCodeDoc: { contains: termino, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const embarques = await prisma.embarque.findMany({
    where,
    include: { _count: { select: { pallets: true } } },
    orderBy: { importadoEn: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        titulo="Importar PL"
        descripcion="Importa el Packing List (Excel) de un embarque de exportación: queda registrado con el detalle por pallet y el archivo original disponible para descargar."
        acciones={
          <Button asChild>
            <Link href="/comex/importar-pl/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva importación
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid min-w-[260px] flex-1 gap-1.5">
          <Label htmlFor="busqueda">Ship Number, Contenedor, Pallet, Variedad, LPN o Trazabilidad</Label>
          <Input id="busqueda" name="busqueda" placeholder="Ej. DEPE026-2201, MNBU0345979, R26M03526..." defaultValue={busqueda ?? ""} />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
        {termino && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/comex/importar-pl">Limpiar</Link>
          </Button>
        )}
      </form>

      {embarques.length === 0 ? (
        <EmptyState
          icono={FileSpreadsheet}
          titulo={termino ? "No hay embarques importados que coincidan con la búsqueda" : "Aún no hay embarques importados"}
          descripcion={
            termino
              ? "Prueba con otro Ship Number, pallet, variedad, LPN o código de trazabilidad."
              : "Importa el primer Packing List con el botón de arriba."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N.º interno</TableHead>
              <TableHead>Ship Number</TableHead>
              <TableHead>Contenedor</TableHead>
              <TableHead>Naviera</TableHead>
              <TableHead>Fecha de carga</TableHead>
              <TableHead>N.º de pallets</TableHead>
              <TableHead>Importado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {embarques.map((e) => (
              <TableRow key={e.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/comex/importar-pl/${e.id}`} className="text-primary hover:underline">
                    {e.numero}
                  </Link>
                </TableCell>
                <TableCell>{e.shipNumber}</TableCell>
                <TableCell>{e.contenedor ?? "—"}</TableCell>
                <TableCell>{e.naviera ?? "—"}</TableCell>
                <TableCell>{e.fechaCarga ? formatDate(e.fechaCarga) : "—"}</TableCell>
                <TableCell>{formatCantidad(e._count.pallets)}</TableCell>
                <TableCell>{e.importadoEn ? formatDate(e.importadoEn) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
