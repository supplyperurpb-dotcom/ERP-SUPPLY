import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationControls, REGISTROS_POR_PAGINA, calcularPagina } from "@/components/shared/pagination-controls";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatKg } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export default async function DespachoIQFPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const { q, pagina: paginaParam } = await searchParams;
  const pagina = calcularPagina(paginaParam);

  const where: Prisma.DespachoIQFWhereInput = q
    ? {
        OR: [
          { numero: { contains: q, mode: "insensitive" } },
          { placaCamion: { contains: q, mode: "insensitive" } },
          { conductor: { contains: q, mode: "insensitive" } },
          { numeroGuiaRemision: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, despachos] = await Promise.all([
    prisma.despachoIQF.count({ where }),
    prisma.despachoIQF.findMany({
      where,
      include: { tarjas: { include: { pallet: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * REGISTROS_POR_PAGINA,
      take: REGISTROS_POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / REGISTROS_POR_PAGINA));

  return (
    <div>
      <PageHeader
        titulo="Despacho IQF"
        descripcion="Registro de pallets IQF despachados (con tarja generada) hacia su siguiente destino: placa del camión, conductor y fecha/hora de salida. Independiente del Despacho de Ingreso de Materia Prima."
        acciones={
          <Button asChild>
            <Link href="/acopio/despacho-iqf/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo despacho IQF
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="q">Número, placa, conductor o guía</Label>
          <Input id="q" name="q" placeholder="Ej. DESPIQF-0001" defaultValue={q ?? ""} className="w-[220px]" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {q && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/despacho-iqf">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {despachos.length === 0 ? (
        <EmptyState
          icono={Truck}
          titulo={q ? "No hay despachos IQF que coincidan con el filtro" : "Aún no hay despachos IQF registrados"}
          descripcion={
            q ? "Prueba con otro criterio de búsqueda o limpia el filtro." : "Registra el primer despacho con el botón de arriba."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Conductor</TableHead>
                <TableHead>Guía de remisión</TableHead>
                <TableHead>Fecha de despacho</TableHead>
                <TableHead>N.º de tarjas</TableHead>
                <TableHead>Total bandejas</TableHead>
                <TableHead>Peso neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despachos.map((d) => {
                const totalBandejas = d.tarjas.reduce((acc, t) => acc + t.pallet.cantidadBandejas, 0);
                const totalNeto = d.tarjas.reduce((acc, t) => acc + Number(t.pallet.pesoNetoKg), 0);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.numero}</TableCell>
                    <TableCell>{d.placaCamion}</TableCell>
                    <TableCell>{d.conductor}</TableCell>
                    <TableCell>{d.numeroGuiaRemision ?? "—"}</TableCell>
                    <TableCell>
                      {formatDate(d.fechaDespacho)}
                      {d.horaDespacho ? ` ${d.horaDespacho}` : ""}
                    </TableCell>
                    <TableCell>{d.tarjas.length}</TableCell>
                    <TableCell>{totalBandejas}</TableCell>
                    <TableCell>{formatKg(totalNeto)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <PaginationControls paginaActual={pagina} totalPaginas={totalPaginas} total={total} searchParams={{ q }} />
        </>
      )}
    </div>
  );
}
