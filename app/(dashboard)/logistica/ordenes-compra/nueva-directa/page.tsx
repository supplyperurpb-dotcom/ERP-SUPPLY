import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { obtenerValoresActivos } from "@/lib/listas";
import { siguienteNumero } from "@/lib/utils";
import { NOMBRE_ORDEN, PREFIJO_ORDEN, type CategoriaCompraCodigo, type TipoOrdenCodigo } from "@/lib/constants/compras";
import { OrdenCompraDirectaForm } from "./orden-compra-directa-form";

export default async function NuevaOrdenCompraDirectaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; tipo?: string }>;
}) {
  const { categoria, tipo } = await searchParams;
  const categoriaSeleccionada: CategoriaCompraCodigo = categoria === "SERVICIO" ? "SERVICIO" : "COMPRA";
  const tipoOrden: TipoOrdenCodigo = tipo === "ABIERTA" ? "ABIERTA" : "ESTANDAR";

  const [skus, ordenesCompra, ordenesServicio, proveedores, centrosCosto] = await Promise.all([
    prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.ordenCompra.findMany({ where: { categoria: "COMPRA", tipoOrden }, select: { numero: true } }),
    prisma.ordenCompra.findMany({ where: { categoria: "SERVICIO", tipoOrden }, select: { numero: true } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    obtenerValoresActivos("CENTRO_COSTO"),
  ]);
  // Solo un adelanto por cada categoría posible — el número real se asigna
  // recién al guardar, según la categoría que el usuario elija en el
  // formulario (acá no hay botón "Nueva Compra"/"Nuevo Servicio" por
  // separado que la fije de antemano).
  const numerosTentativos = {
    COMPRA: siguienteNumero(ordenesCompra.map((o) => o.numero), PREFIJO_ORDEN.COMPRA[tipoOrden], 9),
    SERVICIO: siguienteNumero(ordenesServicio.map((o) => o.numero), PREFIJO_ORDEN.SERVICIO[tipoOrden], 9),
  };

  return (
    <div>
      <PageHeader
        titulo={`Nueva ${NOMBRE_ORDEN[categoriaSeleccionada].toLowerCase()} directa ${tipoOrden === "ABIERTA" ? "abierta" : "estándar"}`}
        descripcion="Arma la orden a mano, sin jalarla de ninguna solicitud de pedido — para compras puntuales que no pasaron por ese flujo. Igual pasa por las firmas de aprobación según su monto."
      />
      <OrdenCompraDirectaForm
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida, categoria: s.categoria }))}
        categoria={categoriaSeleccionada}
        tipoOrden={tipoOrden}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : "",
          condicionPago: p.condicionPago,
        }))}
        centrosCosto={centrosCosto}
        numerosTentativos={numerosTentativos}
      />
    </div>
  );
}
