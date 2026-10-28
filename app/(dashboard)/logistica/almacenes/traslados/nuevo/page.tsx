import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen, calcularStockPorLote } from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { TrasladoAlmacenForm } from "./traslado-almacen-form";

export default async function NuevoTrasladoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [almacenes, proveedores, existentes] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.trasladoAlmacen.findMany({ select: { numero: true } }),
  ]);
  // Solo un adelanto: el número real se asigna recién al guardar (ver
  // crearTrasladoAlmacenAction) — mismo criterio que OC/Solped.
  const numeroTentativo = siguienteNumero(existentes.map((t) => t.numero), "TA-");

  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, Awaited<ReturnType<typeof calcularStockAlmacen>>> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  // Solo los almacenes de Agroquímicos y Fertilizantes exigen lote al
  // trasladar — se precalcula el stock por lote de cada SKU con stock ahí,
  // para el selector de lote del formulario (mismo criterio que Consumo).
  const lotesPorAlmacen: Record<string, Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>>> = {};
  for (const a of almacenes) {
    if (a.categoriaGeneral !== "PESTICIDAS" && a.categoriaGeneral !== "FERTILIZANTES") continue;
    const skuIds = stockPorAlmacen[a.id]?.map((s) => s.skuId) ?? [];
    const lotesPorSku = await Promise.all(skuIds.map((skuId) => calcularStockPorLote(a.id, skuId)));
    lotesPorAlmacen[a.id] = Object.fromEntries(skuIds.map((skuId, i) => [skuId, lotesPorSku[i]]));
  }

  return (
    <div>
      <PageHeader
        titulo={`Nuevo traslado entre almacenes — ${numeroTentativo}`}
        descripcion="Mueve stock propio de un almacén a otro. Solo se pueden trasladar productos con stock disponible en el almacén de origen elegido; se valoriza con su precio unitario ponderado del día del traslado."
      />
      <TrasladoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : "",
        }))}
        stockPorAlmacen={stockPorAlmacen}
        lotesPorAlmacen={lotesPorAlmacen}
        almacenOrigenIdInicial={almacenId}
      />
    </div>
  );
}
