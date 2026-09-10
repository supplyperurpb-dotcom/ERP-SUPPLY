import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatKg } from "@/lib/utils";
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

export default async function IngresosFrutaPage() {
  const ingresos = await prisma.ingresoFruta.findMany({
    include: {
      proveedor: true,
      pallets: { select: { modulo: true, variedad: true, pesoNetoKg: true } },
      _count: { select: { pallets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Ingresos de fruta"
        descripcion="Registro de llegada de camiones con arándano fresco. Cada camión agrupa una o más líneas de pesaje por módulo/turno/variedad, con tara y peso neto calculados automáticamente."
        acciones={
          <Button asChild>
            <Link href="/acopio/ingresos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo ingreso
            </Link>
          </Button>
        }
      />

      {ingresos.length === 0 ? (
        <EmptyState
          icono={Boxes}
          titulo="Aún no hay ingresos de fruta registrados"
          descripcion="Registra el primer ingreso de materia prima con el botón de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor / Fundo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Módulos</TableHead>
              <TableHead>Fecha de ingreso</TableHead>
              <TableHead>N.º de líneas</TableHead>
              <TableHead>Peso neto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingresos.map((ingreso) => {
              const pesoNetoTotal = ingreso.pallets.reduce((acc, p) => acc + Number(p.pesoNetoKg), 0);
              const modulos = Array.from(new Set(ingreso.pallets.map((p) => p.modulo))).join(", ");
              return (
                <TableRow key={ingreso.id}>
                  <TableCell className="font-medium">{ingreso.numero}</TableCell>
                  <TableCell>{ingreso.proveedor.razonSocial}</TableCell>
                  <TableCell>{ingreso.placaTransporte ?? "—"}</TableCell>
                  <TableCell>{ingreso.lote}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={modulos}>
                    {modulos || "—"}
                  </TableCell>
                  <TableCell>{formatDate(ingreso.fechaIngreso)}</TableCell>
                  <TableCell>{ingreso._count.pallets}</TableCell>
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
