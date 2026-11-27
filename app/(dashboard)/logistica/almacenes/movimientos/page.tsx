import { PageHeader } from "@/components/shared/page-header";
import { PaginationControls, REGISTROS_POR_PAGINA, calcularPagina } from "@/components/shared/pagination-controls";
import { prisma } from "@/lib/db/prisma";
import { calcularMovimientosGlobal, type TipoMovimientoGlobal } from "@/lib/stock-almacen";
import { NuevoMovimientoDialog } from "../nuevo-movimiento-dialog";
import { FiltrosMovimientosBar } from "./filtros-movimientos";
import { MovimientosTable } from "./movimientos-table";

export default async function MovimientosAlmacenesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filtros = {
    proveedorId: sp.proveedorId,
    numero: sp.numero,
    tipo: sp.tipo as TipoMovimientoGlobal | undefined,
    desde: sp.desde,
    hasta: sp.hasta,
  };

  const [filas, proveedores, almacenes] = await Promise.all([
    calcularMovimientosGlobal(filtros),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);

  const pagina = calcularPagina(sp.pagina);
  const totalPaginas = Math.max(1, Math.ceil(filas.length / REGISTROS_POR_PAGINA));
  const filasPagina = filas.slice((pagina - 1) * REGISTROS_POR_PAGINA, pagina * REGISTROS_POR_PAGINA);

  return (
    <div>
      <PageHeader
        titulo="Movimientos"
        descripcion="Ingresos, consumos, traslados y devoluciones de todos los almacenes."
        acciones={
          <NuevoMovimientoDialog
            almacenes={almacenes.map((a) => ({
              id: a.id,
              codigo: a.codigo,
              nombre: a.nombre,
              categoriaGeneral: a.categoriaGeneral,
              esGeneral: a.esGeneral,
            }))}
          />
        }
      />

      <FiltrosMovimientosBar valores={filtros} proveedores={proveedores.map((p) => ({ id: p.id, razonSocial: p.razonSocial }))} />

      <MovimientosTable filas={filasPagina} />

      <PaginationControls paginaActual={pagina} totalPaginas={totalPaginas} total={filas.length} searchParams={sp} />
    </div>
  );
}
