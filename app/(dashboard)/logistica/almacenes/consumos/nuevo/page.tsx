import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen, calcularStockPorLote, calcularSolicitudesDespachoPendientes } from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { TIPOS_VEHICULO } from "@/lib/validations/vehiculo";
import { ConsumoAlmacenForm } from "./consumo-almacen-form";

export default async function NuevoConsumoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string; solicitudDespachoId?: string }>;
}) {
  const { almacenId, solicitudDespachoId } = await searchParams;

  const [almacenes, retiradores, vehiculos, existentes] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.retiradorAutorizado.findMany({
      where: { activo: true },
      include: { almacenesPermitidos: true },
      orderBy: { apellidos: "asc" },
    }),
    prisma.vehiculo.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
    prisma.consumoAlmacen.findMany({ select: { numero: true } }),
  ]);
  // Solo un adelanto: el número real se asigna recién al guardar (ver
  // crearConsumoAlmacenAction) — mismo criterio que OC/Solped.
  const numeroTentativo = siguienteNumero(existentes.map((c) => c.numero), "CA-");
  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, Awaited<ReturnType<typeof calcularStockAlmacen>>> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  // En un almacén de Combustible solo se puede consumir SKU de subfamilia
  // "Combustibles" (diesel/gasohol) — se filtra acá, antes de pasarle el
  // stock al formulario, para que ni siquiera aparezcan en el buscador.
  const almacenesCombustible = almacenes.filter((a) => a.categoriaGeneral === "COMBUSTIBLE");
  const skuIdsEnAlmacenesCombustible = [...new Set(almacenesCombustible.flatMap((a) => stockPorAlmacen[a.id]?.map((s) => s.skuId) ?? []))];
  if (skuIdsEnAlmacenesCombustible.length > 0) {
    const skusCombustible = await prisma.sku.findMany({
      where: { id: { in: skuIdsEnAlmacenesCombustible }, subfamilia: "Combustibles" },
      select: { id: true },
    });
    const skuIdsCombustible = new Set(skusCombustible.map((s) => s.id));
    for (const a of almacenesCombustible) {
      stockPorAlmacen[a.id] = (stockPorAlmacen[a.id] ?? []).filter((s) => skuIdsCombustible.has(s.skuId));
    }
  }

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

  let solicitudDespacho = null;
  if (solicitudDespachoId) {
    const pendientes = await calcularSolicitudesDespachoPendientes();
    solicitudDespacho = pendientes.find((s) => s.id === solicitudDespachoId) ?? null;
  }

  return (
    <div>
      <PageHeader
        titulo={`Nuevo consumo de almacén — ${numeroTentativo}`}
        descripcion={
          solicitudDespacho
            ? `Atendiendo la solicitud de despacho ${solicitudDespacho.numero}. Puedes ajustar las cantidades si no entregas todo lo pedido.`
            : "Registra el consumo de materiales de un almacén. Solo se pueden consumir productos con stock disponible en el almacén elegido. El precio unitario ponderado se calcula automáticamente según los ingresos históricos de ese producto en ese almacén."
        }
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
        vehiculos={vehiculos.map((v) => ({
          id: v.id,
          placa: v.placa,
          codigoEquipo: v.codigoEquipo,
          tipo: TIPOS_VEHICULO.find((t) => t.valor === v.tipo)?.nombre ?? v.tipo,
        }))}
        almacenIdInicial={almacenId}
        solicitudDespachoInicial={
          solicitudDespacho
            ? {
                id: solicitudDespacho.id,
                numero: solicitudDespacho.numero,
                almacenId: solicitudDespacho.almacenId,
                items: solicitudDespacho.items,
              }
            : undefined
        }
      />
    </div>
  );
}
