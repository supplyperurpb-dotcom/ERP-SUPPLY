import Link from "next/link";
import { Plus, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatKg, rangoFechaIngreso } from "@/lib/utils";
import type { EstadoDocumento } from "@prisma/client";

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
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const fechaIngreso = rangoFechaIngreso(desde, hasta);

  const ingresos = await prisma.ingresoIQF.findMany({
    where: fechaIngreso ? { fechaIngreso } : undefined,
    include: {
      proveedor: true,
      pallets: { select: { variedad: true, cantidadBandejas: true, pesoNetoKg: true } },
      _count: { select: { pallets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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
        {(desde || hasta) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/ingreso-iqf">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {ingresos.length === 0 ? (
        <EmptyState
          icono={Snowflake}
          titulo={desde || hasta ? "No hay ingresos IQF en el rango de fechas seleccionado" : "Aún no hay ingresos IQF registrados"}
          descripcion={
            desde || hasta
              ? "Prueba con otro rango de fechas o limpia el filtro."
              : "Registra el primer ingreso de descarte de planta con el botón de arriba."
          }
        />
      ) : (
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
      )}
    </div>
  );
}
