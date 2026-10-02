import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularSolicitudesConPendientes } from "@/lib/compras";
import { NOMBRE_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { OrdenCompraForm } from "./orden-compra-form";

export default async function NuevaOrdenCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const categoriaSeleccionada: CategoriaCompraCodigo = categoria === "SERVICIO" ? "SERVICIO" : "COMPRA";

  const [solicitudes, proveedores] = await Promise.all([
    calcularSolicitudesConPendientes(prisma, categoriaSeleccionada),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo={`Nueva ${NOMBRE_ORDEN[categoriaSeleccionada].toLowerCase()}`}
        descripcion="Selecciona ítems pendientes de una o varias solicitudes aprobadas, ingresa precios y genera la orden para un proveedor. Solo se listan solicitudes de esta misma categoría."
      />
      <OrdenCompraForm
        solicitudes={solicitudes}
        categoria={categoriaSeleccionada}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : "",
        }))}
      />
    </div>
  );
}
