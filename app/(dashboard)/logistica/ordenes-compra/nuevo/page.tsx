import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularSolicitudesConPendientes } from "@/lib/compras";
import { OrdenCompraForm } from "./orden-compra-form";

export default async function NuevaOrdenCompraPage() {
  const [solicitudes, proveedores] = await Promise.all([
    calcularSolicitudesConPendientes(),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Nueva orden de compra"
        descripcion="Selecciona ítems pendientes de una o varias solicitudes de pedido, ingresa precios y genera la orden para un proveedor."
      />
      <OrdenCompraForm
        solicitudes={solicitudes}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : "",
        }))}
      />
    </div>
  );
}
