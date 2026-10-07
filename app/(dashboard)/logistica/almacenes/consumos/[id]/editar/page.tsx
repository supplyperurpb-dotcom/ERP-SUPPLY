import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen, calcularStockPorLote, type FilaStockAlmacen } from "@/lib/stock-almacen";
import { ConsumoAlmacenForm } from "../../nuevo/consumo-almacen-form";
import type { ConsumoAlmacenInput } from "@/lib/validations/almacen";

export default async function EditarConsumoAlmacenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [consumo, almacenes, retiradores] = await Promise.all([
    prisma.consumoAlmacen.findUnique({ where: { id }, include: { items: { include: { sku: true } } } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.retiradorAutorizado.findMany({
      where: { activo: true },
      include: { almacenesPermitidos: true },
      orderBy: { apellidos: "asc" },
    }),
  ]);
  if (!consumo) notFound();

  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, FilaStockAlmacen[]> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  // Igual que en traslados: se le devuelve al almacén lo que este mismo
  // consumo ya le había restado, para que "disponible" refleje el mundo sin
  // este consumo (el servidor lo reversa de verdad al guardar).
  const filas = [...(stockPorAlmacen[consumo.almacenOrigenId] ?? [])];
  for (const item of consumo.items) {
    const idx = filas.findIndex((f) => f.skuId === item.skuId);
    if (idx >= 0) {
      filas[idx] = { ...filas[idx], cantidad: filas[idx].cantidad + Number(item.cantidad) };
    } else {
      filas.push({
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: Number(item.cantidad),
        precioUnitarioPonderado: Number(item.precioUnitarioPonderado),
      });
    }
  }
  stockPorAlmacen[consumo.almacenOrigenId] = filas;

  // Igual que con el stock agregado: se le devuelve a cada lote lo que
  // este mismo consumo ya le había restado.
  const almacenEditado = almacenes.find((a) => a.id === consumo.almacenOrigenId);
  const lotesPorAlmacen: Record<string, Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>>> = {};
  if (almacenEditado?.categoriaGeneral === "AGROQUIMICOS_FERTILIZANTES") {
    const skuIds = [...new Set(filas.map((f) => f.skuId))];
    const lotesPorSku = await Promise.all(skuIds.map((skuId) => calcularStockPorLote(consumo.almacenOrigenId, skuId)));
    const mapa: Record<string, Awaited<ReturnType<typeof calcularStockPorLote>>> = {};
    skuIds.forEach((skuId, i) => {
      mapa[skuId] = lotesPorSku[i];
    });
    for (const item of consumo.items) {
      if (!item.lote) continue;
      const lotes = mapa[item.skuId];
      if (!lotes) continue;
      const lote = lotes.find((l) => l.lote === item.lote);
      if (lote) lote.cantidad += Number(item.cantidad);
      else lotes.push({ lote: item.lote, fechaProduccion: item.fechaProduccion, fechaVencimiento: item.fechaVencimiento, cantidad: Number(item.cantidad), unidadMedida: item.unidadMedida });
    }
    lotesPorAlmacen[consumo.almacenOrigenId] = mapa;
  }

  const valoresIniciales: ConsumoAlmacenInput = {
    fecha: consumo.fecha.toISOString().slice(0, 10) as unknown as Date,
    horaRetiro: consumo.horaRetiro ?? "",
    almacenOrigenId: consumo.almacenOrigenId,
    retiradoPor: consumo.retiradoPor ?? "",
    retiradoPorDni: consumo.retiradoPorDni ?? "",
    firmaArchivo: consumo.firmaArchivo ?? "",
    fotoEvidenciaArchivo: consumo.fotoEvidenciaArchivo ?? "",
    observaciones: consumo.observaciones ?? "",
    items: consumo.items.map((item) => ({
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
        titulo={`Editar consumo ${consumo.numero}`}
        descripcion="Modifica los datos de este consumo. El stock del almacén se recalcula al guardar."
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
        edicion={{ id: consumo.id, valoresIniciales }}
      />
    </div>
  );
}
