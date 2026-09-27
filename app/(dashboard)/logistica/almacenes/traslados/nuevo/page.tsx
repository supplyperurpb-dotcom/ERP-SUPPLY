import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen } from "@/lib/stock-almacen";
import { TrasladoAlmacenForm } from "./traslado-almacen-form";

export default async function NuevoTrasladoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const almacenes = await prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, Awaited<ReturnType<typeof calcularStockAlmacen>>> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });

  return (
    <div>
      <PageHeader
        titulo="Nuevo traslado entre almacenes"
        descripcion="Mueve productos de un almacén a otro. Solo se pueden trasladar productos con stock disponible en el almacén de origen elegido."
      />
      <TrasladoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        stockPorAlmacen={stockPorAlmacen}
        almacenOrigenIdInicial={almacenId}
      />
    </div>
  );
}
