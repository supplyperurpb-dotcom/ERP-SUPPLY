import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import type { CategoriaRechazo, EstadoRechazoItem, Prisma } from "@prisma/client";

const CATEGORIA_LABEL: Record<CategoriaRechazo, string> = {
  TERMINAL_MARKET: "Terminal Market",
  NON_FRESH: "Non-Fresh",
  DONATION: "Donation",
  PASS: "Pass (fruta buena)",
};

const ESTADO_VARIANT: Record<EstadoRechazoItem, "success" | "destructive" | "secondary" | "warning"> = {
  PENDIENTE: "secondary",
  CONFIRMADO: "success",
  ANULADO: "destructive",
  DISPUTADO: "warning",
};

export default async function ConsultaRechazosPage({
  searchParams,
}: {
  searchParams: Promise<{ busqueda?: string }>;
}) {
  const { busqueda } = await searchParams;
  const termino = busqueda?.trim();

  const where: Prisma.RechazoItemWhereInput = termino
    ? {
        OR: [
          { lpn: { contains: termino, mode: "insensitive" } },
          { variedad: { contains: termino, mode: "insensitive" } },
          { embarquePallet: { palletNumber: { contains: termino, mode: "insensitive" } } },
          { embarquePallet: { embarque: { shipNumber: { contains: termino, mode: "insensitive" } } } },
          { rechazoCorreo: { poNumber: { contains: termino, mode: "insensitive" } } },
        ],
      }
    : {};

  const items = await prisma.rechazoItem.findMany({
    where,
    include: {
      embarquePallet: { select: { palletNumber: true, embarque: { select: { numero: true, shipNumber: true } } } },
      rechazoCorreo: { select: { poNumber: true, asuntoCorreo: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        titulo="Consulta de Rechazos"
        descripcion="Busca una línea de rechazo ya registrada por LPN, Pallet, Variedad, Ship Number o PO."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid min-w-[280px] flex-1 gap-1.5">
          <Label htmlFor="busqueda">LPN, Pallet, Variedad, Ship Number o PO</Label>
          <Input id="busqueda" name="busqueda" placeholder="Ej. 2012763642, R26M03526, RAYMI..." defaultValue={busqueda ?? ""} />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
        {termino && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/comex/consulta-rechazos">Limpiar</Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          icono={SearchX}
          titulo={termino ? "No hay rechazos que coincidan con la búsqueda" : "Aún no hay rechazos registrados"}
          descripcion={termino ? "Prueba con otro LPN, pallet, variedad, Ship Number o PO." : "Registra el primero en Registro de Rechazos."}
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
              <TableHead numeric>Cajas rechazadas</TableHead>
              <TableHead>Categoría final</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.embarquePallet?.embarque.shipNumber ?? "—"}</TableCell>
                <TableCell>{it.rechazoCorreo.poNumber ?? "—"}</TableCell>
                <TableCell>
                  <Link href={`/comex/registro-rechazos/${it.rechazoCorreoId}`} className="text-primary hover:underline">
                    {it.embarquePallet?.palletNumber ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="font-mono">{it.lpn}</TableCell>
                <TableCell>{it.variedad ?? "—"}</TableCell>
                <TableCell numeric>{it.cajasRechazadas}</TableCell>
                <TableCell>{it.categoriaFinal ? CATEGORIA_LABEL[it.categoriaFinal] : "—"}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[it.estado]}>{it.estado}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
