import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen, calcularStockPorLote } from "@/lib/stock-almacen";
import { ConsumoAlmacenForm } from "./consumo-almacen-form";

export default async function NuevoConsumoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [almacenes, retiradores] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.retiradorAutorizado.findMany({
      where: { activo: true },
      include: { almacenesPermitidos: true },
      orderBy: { apellidos: "asc" },
    }),
  ]);
  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, Awaited<ReturnType<typeof calcularStockAlmacen>>> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  // Solo los almacenes de Agroquímicos y Fertilizantes exigen lote — se
  // precalcula el stock por lote de cada SKU con stock ahí, para el
  // selector de lote del formulario.
  const lotesPorAlmacen: Record<string, Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>>> = {};
  for (const a of almacenes) {
    if (a.categoriaGeneral !== "AGROQUIMICOS_FERTILIZANTES") continue;
    const skuIds = stockPorAlmacen[a.id]?.map((s) => s.skuId) ?? [];
    const lotesPorSku = await Promise.all(skuIds.map((skuId) => calcularStockPorLote(a.id, skuId)));
    lotesPorAlmacen[a.id] = Object.fromEntries(skuIds.map((skuId, i) => [skuId, lotesPorSku[i]]));
  }

  return (
    <div>
      <PageHeader
        titulo="Nuevo consumo de almacén"
        descripcion="Registra el consumo de materiales de un almacén. Solo se pueden consumir productos con stock disponible en el almacén elegido. El precio unitario ponderado se calcula automáticamente según los ingresos históricos de ese producto en ese almacén."
      />
      <ConsumoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))}
        stockPorAlmacen={stockPorAlmacen}
        lotesPorAlmacen={lotesPorAlmacen}
        retiradores={retiradores.map((r) => ({
          id: r.id,
          nombreCompleto: `${r.nombres} ${r.apellidos}`,
          dni: r.dni,
          almacenesIds: r.almacenesPermitidos.map((p) => p.almacenId),
        }))}
        almacenIdInicial={almacenId}
      />
    </div>
  );
}
