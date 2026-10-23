import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen } from "@/lib/stock-almacen";
import { SolicitudDespachoBuilder } from "./solicitud-despacho-builder";

export default async function NuevaSolicitudDespachoPage() {
  const almacenes = await prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, Awaited<ReturnType<typeof calcularStockAlmacen>>> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  return (
    <div>
      <PageHeader
        titulo="Nueva solicitud de despacho"
        descripcion="Pide que Almacén te despache cierta cantidad de un producto. Elige el almacén y selecciona de su stock disponible."
      />
      <SolicitudDespachoBuilder
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        stockPorAlmacen={stockPorAlmacen}
      />
    </div>
  );
}
