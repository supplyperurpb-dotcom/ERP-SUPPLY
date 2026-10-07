import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen, type FilaStockAlmacen } from "@/lib/stock-almacen";
import { ConsumoAlmacenForm } from "../../nuevo/consumo-almacen-form";
import type { ConsumoAlmacenInput } from "@/lib/validations/almacen";

export default async function EditarConsumoAlmacenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [consumo, almacenes] = await Promise.all([
    prisma.consumoAlmacen.findUnique({ where: { id }, include: { items: { include: { sku: true } } } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
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

  const valoresIniciales: ConsumoAlmacenInput = {
    fecha: consumo.fecha.toISOString().slice(0, 10) as unknown as Date,
    horaRetiro: consumo.horaRetiro ?? "",
    almacenOrigenId: consumo.almacenOrigenId,
    retiradoPor: consumo.retiradoPor ?? "",
    firmaArchivo: consumo.firmaArchivo ?? "",
    fotoEvidenciaArchivo: consumo.fotoEvidenciaArchivo ?? "",
    observaciones: consumo.observaciones ?? "",
    items: consumo.items.map((item) => ({
      skuId: item.skuId,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
    })),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar consumo ${consumo.numero}`}
        descripcion="Modifica los datos de este consumo. El stock del almacén se recalcula al guardar."
      />
      <ConsumoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        stockPorAlmacen={stockPorAlmacen}
        edicion={{ id: consumo.id, valoresIniciales }}
      />
    </div>
  );
}
