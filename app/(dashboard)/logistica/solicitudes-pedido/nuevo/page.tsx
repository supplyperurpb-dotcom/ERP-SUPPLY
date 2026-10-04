import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { siguienteNumero } from "@/lib/utils";
import { NOMBRE_SOLICITUD, PREFIJO_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { SolicitudPedidoForm } from "./solicitud-pedido-form";

export default async function NuevaSolicitudPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const categoriaInicial: CategoriaCompraCodigo = categoria === "SERVICIO" ? "SERVICIO" : "COMPRA";

  // En SERVICIO, el catálogo son solo los SKU de Servicios (uno por
  // subfamilia, p. ej. "Apicultura"); en COMPRA se excluyen esos SKU.
  const [skus, existentes] = await Promise.all([
    prisma.sku.findMany({
      where: {
        activo: true,
        categoria: categoriaInicial === "SERVICIO" ? "Servicios" : { not: "Servicios" },
      },
      orderBy: { codigo: "asc" },
    }),
    prisma.solicitudPedido.findMany({ where: { categoria: categoriaInicial }, select: { numero: true } }),
  ]);
  // Solo un adelanto: el número real se asigna recién al guardar.
  const numeroTentativo = siguienteNumero(existentes.map((s) => s.numero), PREFIJO_SOLICITUD[categoriaInicial], 9);

  return (
    <div>
      <PageHeader
        titulo={`Nueva ${NOMBRE_SOLICITUD[categoriaInicial].toLowerCase()} — ${numeroTentativo}`}
        descripcion="Registra la necesidad de un área: productos, cantidades y centro de costo. Luego podrá convertirse en una o varias órdenes."
      />
      <SolicitudPedidoForm
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        categoriaInicial={categoriaInicial}
      />
    </div>
  );
}
