import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { SolicitudPedidoForm } from "./solicitud-pedido-form";

export default async function NuevaSolicitudPedidoPage() {
  const skus = await prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } });

  return (
    <div>
      <PageHeader
        titulo="Nueva solicitud de pedido"
        descripcion="Registra la necesidad de compra de un área: productos, cantidades y centro de costo. Luego podrá convertirse en una o varias órdenes de compra."
      />
      <SolicitudPedidoForm
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
      />
    </div>
  );
}
