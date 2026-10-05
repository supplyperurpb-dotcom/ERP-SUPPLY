import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularOcPendientesIngreso } from "@/lib/stock-almacen";
import { IngresoAlmacenForm } from "./ingreso-almacen-form";

export default async function NuevoIngresoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [almacenesGenerales, ordenesConPendientes] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true, esGeneral: true }, orderBy: { nombre: "asc" } }),
    calcularOcPendientesIngreso(),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso a almacén"
        descripcion="Selecciona el almacén general y la orden de compra de origen: el proveedor, el SKU y el precio se jalan de la OC. Solo ingresas la guía de remisión, la fecha de recepción y cuánto estás recibiendo de cada producto."
      />
      <IngresoAlmacenForm
        almacenes={almacenesGenerales.map((a) => ({ id: a.id, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))}
        ordenesCompra={ordenesConPendientes.map((o) => ({
          id: o.id,
          numero: o.numero,
          moneda: o.moneda,
          proveedorRazonSocial: o.proveedorRazonSocial,
          proveedorRuc: o.proveedorRuc,
          items: o.items.map((i) => ({
            id: i.id,
            skuId: i.skuId,
            codigo: i.codigo,
            descripcion: i.descripcion,
            unidadMedida: i.unidadMedida,
            precioUnitario: i.precioUnitario,
            cantidadOc: i.cantidadOc,
            cantidadPendiente: i.cantidadPendiente,
          })),
        }))}
        almacenIdInicial={almacenId}
      />
    </div>
  );
}
