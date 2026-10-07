import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { calcularOcPendientesIngreso } from "@/lib/stock-almacen";
import { IngresoAlmacenWizard } from "./ingreso-almacen-wizard";

export default async function NuevoIngresoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [usuario, almacenesGenerales, ordenesConPendientes] = await Promise.all([
    getUsuarioActual(),
    prisma.almacen.findMany({ where: { activo: true, esGeneral: true }, orderBy: { nombre: "asc" } }),
    calcularOcPendientesIngreso(),
  ]);
  if (!usuario) redirect("/login");

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso a almacén"
        descripcion="Elige la orden de compra de origen y los ítems a recibir: el proveedor, el SKU y el precio se jalan de la OC."
      />
      <IngresoAlmacenWizard
        usuario={{ nombres: usuario.nombres, apellidos: usuario.apellidos }}
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
