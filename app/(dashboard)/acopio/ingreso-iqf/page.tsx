import Link from "next/link";
import { Plus, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationControls, REGISTROS_POR_PAGINA, calcularPagina } from "@/components/shared/pagination-controls";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatKg, rangoFechaIngreso } from "@/lib/utils";
import type { EstadoDocumento, Prisma } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  ANULADO: "Anulado",
};

const ESTADO_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

export default async function IngresoIQFPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; numero?: string; variedad?: string; pagina?: string }>;
}) {
  const { desde, hasta, numero, variedad, pagina: paginaParam } = await searchParams;
  const fechaIngreso = rangoFechaIngreso(desde, hasta);
  const pagina = calcularPagina(paginaParam);

  const where: Prisma.IngresoIQFWhereInput = {
    ...(fechaIngreso ? { fechaIngreso } : {}),
    ...(numero ? { numero: { contains: numero, mode: "insensitive" } } : {}),
    ...(variedad ? { pallets: { some: { variedad: { contains: variedad, mode: "insensitive" } } } } : {}),
  };

  const [total, ingresos] = await Promise.all([
    prisma.ingresoIQF.count({ where }),
    prisma.ingresoIQF.findMany({
      where,
      include: {
        proveedor: true,
        pallets: { select: { variedad: true, cantidadBandejas: true, pesoNetoKg: true } },
        _count: { select: { pallets: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * REGISTROS_POR_PAGINA,
      take: REGISTROS_POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / REGISTROS_POR_PAGINA));
  const hayFiltro = Boolean(desde || hasta || numero || variedad);

  return (
    <div>
      <PageHeader
        titulo="Ingreso IQF"
        descripcion="Registro de descarte de planta, separado de Ingreso de Materia Prima: cada camión agrupa una o más líneas de pesaje por variedad, con tara y peso neto calculados automáticamente."
        acciones={
          <Button asChild>
            <Link href="/acopio/ingreso-iqf/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo ingreso IQF
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="numero">N.º de ingreso</Label>
          <Input id="numero" name="numero" placeholder="Ej. IQF-0001" defaultValue={numero ?? ""} className="w-[150px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variedad">Variedad</Label>
          <Input id="variedad" name="variedad" placeholder="Ej. ARANA" defaultValue={variedad ?? ""} className="w-[150px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-[170px]" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {hayFiltro && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/ingreso-iqf">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {ingresos.length === 0 ? (
        <EmptyState
          icono={Snowflake}
          titulo={hayFiltro ? "No hay ingresos IQF que coincidan con el filtro" : "Aún no hay ingresos IQF registrados"}
          descripcion={
            hayFiltro
              ? "Prueba con otro criterio de búsqueda o limpia el filtro."
              : "Registra el primer ingreso de descarte de planta con el botón de arriba."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fundo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Variedades</TableHead>
                <TableHead>Fecha de ingreso</TableHead>
                <TableHead>N.º de líneas</TableHead>
                <TableHead>N.º de bandejas</TableHead>
                <TableHead>Peso neto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingresos.map((ingreso) => {
                const pesoNetoTotal = ingreso.pallets.reduce((acc, p) => acc + Number(p.pesoNetoKg), 0);
                const totalBandejas = ingreso.pallets.reduce((acc, p) => acc + p.cantidadBandejas, 0);
                const variedades = Array.from(new Set(ingreso.pallets.map((p) => p.variedad))).join(", ");
                return (
                  <TableRow key={ingreso.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/acopio/ingreso-iqf/${ingreso.id}`} className="text-primary hover:underline">
                        {ingreso.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{ingreso.proveedor.razonSocial}</TableCell>
                    <TableCell>{ingreso.placaTransporte ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={variedades}>
                      {variedades || "—"}
                    </TableCell>
                    <TableCell>{formatDate(ingreso.fechaIngreso, { timeZone: "America/Lima" })}</TableCell>
                    <TableCell>{ingreso._count.pallets}</TableCell>
                    <TableCell>{totalBandejas}</TableCell>
                    <TableCell>{formatKg(pesoNetoTotal)}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[ingreso.estado]}>{ESTADO_LABEL[ingreso.estado]}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <PaginationControls
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            total={total}
            searchParams={{ desde, hasta, numero, variedad }}
          />
        </>
      )}
    </div>
  );
}
