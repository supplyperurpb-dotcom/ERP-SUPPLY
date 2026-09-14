import Link from "next/link";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationControls, REGISTROS_POR_PAGINA, calcularPagina } from "@/components/shared/pagination-controls";
import { prisma } from "@/lib/db/prisma";
import { formatKg, rangoFechaCosecha } from "@/lib/utils";
import { CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET } from "@/lib/constants/pallet";
import type { Prisma } from "@prisma/client";
import { TarjaBoton } from "./tarja-boton";

export default async function TarjasPage({
  searchParams,
}: {
  searchParams: Promise<{ pallet?: string; fundo?: string; variedad?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  const { pallet, fundo, variedad, desde, hasta, pagina: paginaParam } = await searchParams;
  const pagina = calcularPagina(paginaParam);
  const fechaCosecha = rangoFechaCosecha(desde, hasta);

  const filtroIngresoFruta: Prisma.IngresoFrutaWhereInput = {
    ...(fundo ? { proveedor: { razonSocial: { contains: fundo, mode: "insensitive" } } } : {}),
    ...(fechaCosecha ? { fechaCosecha } : {}),
  };

  const where: Prisma.PalletWhereInput = {
    ...(pallet ? { numero: { contains: pallet, mode: "insensitive" } } : {}),
    ...(fundo || variedad || fechaCosecha
      ? {
          lineas: {
            some: {
              ...(Object.keys(filtroIngresoFruta).length > 0 ? { ingresoFruta: filtroIngresoFruta } : {}),
              ...(variedad ? { variedad: { contains: variedad, mode: "insensitive" } } : {}),
            },
          },
        }
      : {}),
  };

  const [total, pallets] = await Promise.all([
    prisma.pallet.count({ where }),
    prisma.pallet.findMany({
      where,
      include: {
        tarja: { include: { despacho: true } },
        lineas: { select: { modulo: true, variedad: true, ingresoFruta: { select: { proveedor: { select: { razonSocial: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * REGISTROS_POR_PAGINA,
      take: REGISTROS_POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / REGISTROS_POR_PAGINA));

  return (
    <div>
      <PageHeader
        titulo="Tarjas"
        descripcion="Etiqueta impresa (10 × 15 cm) de un pallet armado: módulo, variedad, cantidad de bandejas y peso neto. Se genera a partir de los pallets registrados en Ingreso de Materia Prima."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="pallet">N.º de pallet / tarja</Label>
          <Input id="pallet" name="pallet" placeholder="Ej. RPB-00123" defaultValue={pallet ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fundo">Fundo</Label>
          <Input id="fundo" name="fundo" placeholder="Ej. Achirana Blue" defaultValue={fundo ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variedad">Variedad</Label>
          <Input id="variedad" name="variedad" placeholder="Ej. ARANA" defaultValue={variedad ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="desde">Desde (fecha de cosecha)</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde ?? ""} className="w-[170px]" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hasta">Hasta (fecha de cosecha)</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta ?? ""} className="w-[170px]" />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(pallet || fundo || variedad || desde || hasta) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/tarjas">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {pallets.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo={pallet || fundo || variedad || desde || hasta ? "No hay pallets que coincidan con el filtro" : "Aún no hay pallets armados"}
          descripcion={
            pallet || fundo || variedad || desde || hasta
              ? "Prueba con otro criterio de búsqueda o limpia el filtro."
              : "Los pallets se crean al registrar un ingreso de materia prima en Acopio."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pallet</TableHead>
                <TableHead>Fundo</TableHead>
                <TableHead>Módulos / Variedades</TableHead>
                <TableHead>Bandejas</TableHead>
                <TableHead>Peso neto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Despacho</TableHead>
                <TableHead className="text-right">Tarja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pallets.map((pallet) => {
                const proveedores = Array.from(
                  new Set(pallet.lineas.map((l) => l.ingresoFruta.proveedor.razonSocial))
                ).join(", ");
                const detalle = Array.from(
                  new Set(pallet.lineas.map((l) => `${l.modulo} / ${l.variedad}`))
                ).join(", ");
                return (
                  <TableRow key={pallet.id}>
                    <TableCell className="font-medium">{pallet.numero}</TableCell>
                    <TableCell>{proveedores || "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={detalle}>
                      {detalle || "—"}
                    </TableCell>
                    <TableCell>
                      {pallet.cantidadBandejas} / {CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET}
                    </TableCell>
                    <TableCell>{formatKg(Number(pallet.pesoNetoKg))}</TableCell>
                    <TableCell>
                      <Badge variant={pallet.estado === "CERRADO" ? "success" : "secondary"}>
                        {pallet.estado === "CERRADO" ? "Cerrado" : "Abierto"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pallet.tarja?.despacho ? (
                        <Badge variant="success">{pallet.tarja.despacho.numero}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <TarjaBoton palletId={pallet.id} tarjaNumero={pallet.tarja?.numero ?? null} />
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
            searchParams={{ pallet, fundo, variedad, desde, hasta }}
          />
        </>
      )}
    </div>
  );
}
