import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { NOMBRE_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { SolicitudPedidoForm } from "./solicitud-pedido-form";

export default async function NuevaSolicitudPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const categoriaInicial: CategoriaCompraCodigo = categoria === "SERVICIO" ? "SERVICIO" : "COMPRA";

  const skus = await prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } });

  return (
    <div>
      <PageHeader
        titulo={`Nueva ${NOMBRE_SOLICITUD[categoriaInicial].toLowerCase()}`}
        descripcion="Registra la necesidad de un área: productos, cantidades y centro de costo. Luego podrá convertirse en una o varias órdenes."
      />
      <SolicitudPedidoForm
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        categoriaInicial={categoriaInicial}
      />
    </div>
  );
}
