import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen, calcularStockPorLote, type FilaStockAlmacen } from "@/lib/stock-almacen";
import { TrasladoAlmacenForm } from "../../nuevo/traslado-almacen-form";
import type { TrasladoAlmacenInput } from "@/lib/validations/almacen";

export default async function EditarTrasladoAlmacenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [traslado, almacenes, proveedores] = await Promise.all([
    prisma.trasladoAlmacen.findUnique({ where: { id }, include: { items: { include: { sku: true } } } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ]);
  if (!traslado) notFound();

  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, FilaStockAlmacen[]> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  // El origen de este traslado ya tiene descontada su propia cantidad; para
  // que el formulario muestre "disponible" como si este traslado ya
  // estuviera reversado (que es justo lo que hace el servidor al guardar),
  // se le suma de vuelta cada línea (creando la fila si el stock quedó en 0
  // y por eso no aparecía).
  const filasOrigen = [...(stockPorAlmacen[traslado.almacenOrigenId] ?? [])];
  for (const item of traslado.items) {
    const idx = filasOrigen.findIndex((f) => f.skuId === item.skuId);
    if (idx >= 0) {
      filasOrigen[idx] = { ...filasOrigen[idx], cantidad: filasOrigen[idx].cantidad + Number(item.cantidad) };
    } else {
      filasOrigen.push({
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: Number(item.cantidad),
        precioUnitarioPonderado: Number(item.costoUnitario),
      });
    }
  }
  stockPorAlmacen[traslado.almacenOrigenId] = filasOrigen;

  // Igual que en el alta: solo los almacenes de Agroquímicos y
  // Fertilizantes exigen lote, y el lote que este mismo traslado ya usó
  // debe seguir ofreciéndose como opción (se le suma de vuelta su propia
  // cantidad, mismo criterio que arriba con el stock total).
  const lotesPorAlmacen: Record<string, Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>>> = {};
  for (const a of almacenes) {
    if (a.categoriaGeneral !== "AGROQUIMICOS_FERTILIZANTES") continue;
    const skuIds = stockPorAlmacen[a.id]?.map((s) => s.skuId) ?? [];
    const lotesPorSku = await Promise.all(skuIds.map((skuId) => calcularStockPorLote(a.id, skuId)));
    const porSku = Object.fromEntries(skuIds.map((skuId, i) => [skuId, lotesPorSku[i]]));
    if (a.id === traslado.almacenOrigenId) {
      for (const item of traslado.items) {
        if (!item.lote) continue;
        const lotes = porSku[item.skuId] ?? [];
        const idx = lotes.findIndex((l) => l.lote === item.lote);
        if (idx >= 0) {
          lotes[idx] = { ...lotes[idx], cantidad: lotes[idx].cantidad + Number(item.cantidad) };
        } else {
          lotes.push({
            lote: item.lote,
            fechaProduccion: item.fechaProduccion,
            fechaVencimiento: item.fechaVencimiento,
            cantidad: Number(item.cantidad),
            unidadMedida: item.unidadMedida,
          });
        }
        porSku[item.skuId] = lotes;
      }
    }
    lotesPorAlmacen[a.id] = porSku;
  }

  const valoresIniciales: TrasladoAlmacenInput = {
    fecha: traslado.fecha.toISOString().slice(0, 10) as unknown as Date,
    almacenOrigenId: traslado.almacenOrigenId,
    almacenDestinoId: traslado.almacenDestinoId,
    moneda: traslado.moneda as "PEN" | "USD",
    guiaRemision: traslado.guiaRemision ?? "",
    remitenteRuc: traslado.remitenteRuc ?? "",
    remitente: traslado.remitente ?? "",
    flete: traslado.flete !== null ? Number(traslado.flete) : 0,
    observaciones: traslado.observaciones ?? "",
    items: traslado.items.map((item) => ({
      skuId: item.skuId,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
      lote: item.lote ?? "",
      fechaProduccion: item.fechaProduccion ? (item.fechaProduccion.toISOString().slice(0, 10) as unknown as Date) : undefined,
      fechaVencimiento: item.fechaVencimiento ? (item.fechaVencimiento.toISOString().slice(0, 10) as unknown as Date) : undefined,
    })),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar traslado ${traslado.numero}`}
        descripcion="Modifica los datos de este traslado. El stock de ambos almacenes se recalcula al guardar."
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
        edicion={{ id: traslado.id, valoresIniciales }}
      />
    </div>
  );
}
