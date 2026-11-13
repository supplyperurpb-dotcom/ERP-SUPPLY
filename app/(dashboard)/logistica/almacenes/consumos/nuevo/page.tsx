import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import {
  calcularStockAlmacen,
  calcularStockPorLote,
  calcularSolicitudesDespachoPendientes,
  almacenPermitidoParaConsumo,
} from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { TIPOS_VEHICULO } from "@/lib/validations/vehiculo";
import { ConsumoAlmacenForm } from "./consumo-almacen-form";

export default async function NuevoConsumoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string; solicitudDespachoId?: string; solicitudDespachoIds?: string }>;
}) {
  const { almacenId, solicitudDespachoId, solicitudDespachoIds } = await searchParams;
  // Acepta el singular viejo (un solo link "Atender") y el plural nuevo
  // (checkboxes + "Atender Seleccionadas" en la bandeja) — ver
  // solicitudes-despacho-table.tsx.
  const idsSolicitados = [
    ...new Set([...(solicitudDespachoIds ? solicitudDespachoIds.split(",") : []), ...(solicitudDespachoId ? [solicitudDespachoId] : [])]),
  ].filter(Boolean);

  const [almacenesActivos, retiradores, vehiculos, existentes] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.retiradorAutorizado.findMany({
      where: { activo: true },
      include: { almacenesPermitidos: true },
      orderBy: { apellidos: "asc" },
    }),
    prisma.vehiculo.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
    prisma.consumoAlmacen.findMany({ select: { numero: true } }),
  ]);
  // Entre los almacenes de Empaques, solo Producción se puede usar para
  // consumos — ver almacenPermitidoParaConsumo.
  const almacenes = almacenesActivos.filter(almacenPermitidoParaConsumo);
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
  // selector de lote del formulario. Se hace para TODOS (no solo uno): al
  // atender Solicitudes de Despacho, una línea puede terminar en
  // cualquiera de ellos (ver "Ver Productos" en consumo-almacen-form.tsx).
  const almacenesConLote = almacenes.filter((a) => a.categoriaGeneral === "PESTICIDAS" || a.categoriaGeneral === "FERTILIZANTES");
  const lotesPorAlmacen: Record<string, Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>>> = {};
  for (const a of almacenesConLote) {
    const skuIds = stockPorAlmacen[a.id]?.map((s) => s.skuId) ?? [];
    const lotesPorSku = await Promise.all(skuIds.map((skuId) => calcularStockPorLote(a.id, skuId)));
    lotesPorAlmacen[a.id] = Object.fromEntries(skuIds.map((skuId, i) => [skuId, lotesPorSku[i]]));
  }

  let solicitudesDespacho: Awaited<ReturnType<typeof calcularSolicitudesDespachoPendientes>> = [];
  if (idsSolicitados.length > 0) {
    const pendientes = await calcularSolicitudesDespachoPendientes();
    solicitudesDespacho = pendientes.filter((s) => idsSolicitados.includes(s.id));
  }

  // Igual que en la bandeja: no se pueden atender juntas solicitudes de
  // áreas usuarias distintas — se revalida acá por si alguien arma la URL
  // a mano (nunca se confía solo en la restricción del lado del cliente).
  const areasDistintas = new Set(solicitudesDespacho.map((s) => s.area));
  if (areasDistintas.size > 1) {
    return (
      <div>
        <PageHeader titulo="Nuevo consumo de almacén" />
        <p className="text-sm text-destructive">
          No se pueden atender juntas solicitudes de distintas áreas usuarias. Vuelve a la bandeja y atiéndelas por
          separado.
        </p>
        <Link href="/logistica/solicitudes-despacho" className="mt-2 inline-block text-sm underline underline-offset-2">
          Volver a Solicitudes de despacho
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo={`Nuevo consumo de almacén — ${numeroTentativo}`}
        descripcion={
          solicitudesDespacho.length > 0
            ? `Atendiendo ${solicitudesDespacho.length > 1 ? "las solicitudes de despacho" : "la solicitud de despacho"} ${solicitudesDespacho.map((s) => s.numero).join(", ")} (${AREAS_EMPRESA.find((a) => a.valor === solicitudesDespacho[0].area)?.nombre ?? solicitudesDespacho[0].area}). Puedes repartir cada producto entre varios almacenes.`
            : "Registra el consumo de materiales de un almacén. Solo se pueden consumir productos con stock disponible en el almacén elegido. El precio unitario ponderado se calcula automáticamente según los ingresos históricos de ese producto en ese almacén."
        }
      />
      <ConsumoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, codigo: a.codigo, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))}
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
        solicitudesDespachoInicial={solicitudesDespacho.map((s) => ({
          id: s.id,
          numero: s.numero,
          area: s.area,
          items: s.items,
        }))}
      />
    </div>
  );
}
