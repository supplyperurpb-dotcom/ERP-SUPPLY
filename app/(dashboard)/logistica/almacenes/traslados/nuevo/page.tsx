import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularSolicitudesTrasladoPendientes, calcularStockPorLote } from "@/lib/stock-almacen";
import { TrasladoAlmacenWizard } from "./traslado-almacen-wizard";

export default async function NuevoTrasladoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ solicitudId?: string }>;
}) {
  const { solicitudId } = await searchParams;
  const solicitudesPendientes = await calcularSolicitudesTrasladoPendientes();

  // Solo los almacenes de Agroquímicos y Fertilizantes exigen lote al
  // trasladar — se precalcula el stock por lote de cada SKU pendiente en
  // las solicitudes que salen de un almacén de esa categoría.
  const almacenesOrigen = await prisma.almacen.findMany({
    where: { id: { in: [...new Set(solicitudesPendientes.map((s) => s.almacenOrigenId))] } },
  });
  const categoriaPorAlmacen = new Map(almacenesOrigen.map((a) => [a.id, a.categoriaGeneral]));

  const lotesPorSolicitud: Record<string, Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>>> = {};
  for (const solicitud of solicitudesPendientes) {
    if (categoriaPorAlmacen.get(solicitud.almacenOrigenId) !== "AGROQUIMICOS_FERTILIZANTES") continue;
    const skuIds = [...new Set(solicitud.items.map((i) => i.skuId))];
    const lotesPorSku = await Promise.all(skuIds.map((skuId) => calcularStockPorLote(solicitud.almacenOrigenId, skuId)));
    lotesPorSolicitud[solicitud.id] = Object.fromEntries(skuIds.map((skuId, i) => [skuId, lotesPorSku[i]]));
  }

  return (
    <div>
      <PageHeader
        titulo="Nuevo traslado entre almacenes"
        descripcion="Ejecuta una solicitud de traslado pendiente: elige qué ítems mover ahora (pueden ser menos de lo solicitado, el resto queda pendiente para después)."
      />
      <TrasladoAlmacenWizard
        solicitudes={solicitudesPendientes}
        lotesPorSolicitud={lotesPorSolicitud}
        solicitudIdInicial={solicitudId}
      />
    </div>
  );
}
