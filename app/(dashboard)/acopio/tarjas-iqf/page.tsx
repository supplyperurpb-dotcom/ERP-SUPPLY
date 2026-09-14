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
import { TarjaIQFBoton } from "./tarja-iqf-boton";

const ORIGEN_LABEL: Record<"DESCARTE_CAMPO" | "DESCARTE_PLANTA", string> = {
  DESCARTE_CAMPO: "Descarte Campo",
  DESCARTE_PLANTA: "Descarte Planta",
};

export default async function TarjasIQFPage({
  searchParams,
}: {
  searchParams: Promise<{ pallet?: string; variedad?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  const { pallet, variedad, desde, hasta, pagina: paginaParam } = await searchParams;
  const pagina = calcularPagina(paginaParam);
  const fechaCosecha = rangoFechaCosecha(desde, hasta);

  const where: Prisma.PalletIQFWhereInput = {
    ...(pallet ? { numero: { contains: pallet, mode: "insensitive" } } : {}),
    ...(variedad || fechaCosecha
      ? {
          OR: [
            {
              lineas: {
                some: {
                  ...(variedad ? { variedad: { contains: variedad, mode: "insensitive" } } : {}),
                  ...(fechaCosecha ? { ingresoIQF: { fechaCosecha } } : {}),
                },
              },
            },
            {
              lineasFruta: {
                some: {
                  ...(variedad ? { variedad: { contains: variedad, mode: "insensitive" } } : {}),
                  ...(fechaCosecha ? { ingresoFruta: { fechaCosecha } } : {}),
                },
              },
            },
          ],
        }
      : {}),
  };

  // Un pallet IQF viene de Ingreso IQF (líneas en `lineas`, Descarte Planta)
  // o de líneas "Descarte Campo" de Ingreso de Materia Prima (`lineasFruta`)
  // — nunca de ambos a la vez (ver PalletIQF.origen).
  const [total, pallets] = await Promise.all([
    prisma.palletIQF.count({ where }),
    prisma.palletIQF.findMany({
      where,
      include: {
        tarja: { include: { despacho: true } },
        lineas: { select: { variedad: true, ingresoIQF: { select: { proveedor: { select: { razonSocial: true } } } } } },
        lineasFruta: {
          select: { variedad: true, ingresoFruta: { select: { proveedor: { select: { razonSocial: true } } } } },
        },
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
        titulo="Tarjas IQF"
        descripcion="Etiqueta impresa (10 × 15 cm) de un pallet de descarte armado desde Ingreso IQF (Descarte Planta) o desde líneas Descarte Campo de Ingreso de Materia Prima: variedad, cantidad de bandejas y peso neto. Independiente de las Tarjas de fruta exportable."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="pallet">N.º de pallet / tarja</Label>
          <Input id="pallet" name="pallet" placeholder="Ej. PIQF-0001" defaultValue={pallet ?? ""} className="w-[170px]" />
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
        {(pallet || variedad || desde || hasta) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/acopio/tarjas-iqf">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {pallets.length === 0 ? (
        <EmptyState
          icono={Package}
          titulo={pallet || variedad || desde || hasta ? "No hay pallets IQF que coincidan con el filtro" : "Aún no hay pallets IQF armados"}
          descripcion={
            pallet || variedad || desde || hasta
              ? "Prueba con otro criterio de búsqueda o limpia el filtro."
              : "Los pallets IQF se crean al registrar un ingreso en Ingreso IQF o una línea Descarte Campo en Ingreso de Materia Prima."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pallet</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Fundo</TableHead>
                <TableHead>Variedades</TableHead>
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
                  new Set([
                    ...pallet.lineas.map((l) => l.ingresoIQF.proveedor.razonSocial),
                    ...pallet.lineasFruta.map((l) => l.ingresoFruta.proveedor.razonSocial),
                  ])
                ).join(", ");
                const detalle = Array.from(
                  new Set([...pallet.lineas.map((l) => l.variedad), ...pallet.lineasFruta.map((l) => l.variedad)])
                ).join(", ");
                return (
                  <TableRow key={pallet.id}>
                    <TableCell className="font-medium">{pallet.numero}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ORIGEN_LABEL[pallet.origen]}</Badge>
                    </TableCell>
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
                      <TarjaIQFBoton palletId={pallet.id} tarjaNumero={pallet.tarja?.numero ?? null} />
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
            searchParams={{ pallet, variedad, desde, hasta }}
          />
        </>
      )}
    </div>
  );
}
