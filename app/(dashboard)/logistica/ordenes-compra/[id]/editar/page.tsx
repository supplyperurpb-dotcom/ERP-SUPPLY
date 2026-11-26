import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { calcularSolicitudesConPendientes, esComprador } from "@/lib/compras";
import { obtenerValoresActivos } from "@/lib/listas";
import { fechaInputValue } from "@/lib/utils";
import { NOMBRE_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { OrdenCompraEditarForm } from "./orden-compra-editar-form";

export default async function EditarOrdenCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { items: { include: { sku: true, entregas: true } } },
  });
  if (!orden) notFound();

  const usuario = await getUsuarioActual();
  // Mismo criterio que editarOrdenCompraAction: quien la creó, o
  // Comprador/ADMIN — en cualquier estado que no sea APROBADO/RECHAZADO/
  // ANULADO (pedido explícito, 2026-11-25): incluso ya enviada a
  // aprobación (PENDIENTE), no solo en BORRADOR.
  const puedeEditar =
    !!usuario &&
    (orden.estado === "BORRADOR" || orden.estado === "PENDIENTE") &&
    (esComprador(usuario) || orden.creadoPorId === usuario.id);
  if (!puedeEditar) notFound();

  const categoria = orden.categoria as CategoriaCompraCodigo;
  // Una orden "Directa" no tiene ningún ítem con solicitudPedidoItemId —
  // ver crearOrdenCompraDirectaAction. Determina de dónde se agregan
  // productos nuevos al editar: del catálogo de SKU libre, o de lo
  // pendiente de una Solped.
  const esDirecta = orden.items.every((item) => !item.solicitudPedidoItemId);

  const [proveedores, skus, solicitudesPendientes, centrosCosto, campos] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    esDirecta ? prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }) : Promise.resolve([]),
    esDirecta ? Promise.resolve([]) : calcularSolicitudesConPendientes(prisma, categoria),
    esDirecta ? obtenerValoresActivos("CENTRO_COSTO") : Promise.resolve([]),
    esDirecta ? obtenerValoresActivos("CAMPO") : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        titulo={`Editar ${NOMBRE_ORDEN[categoria].toLowerCase()} — ${orden.numero}`}
        descripcion="Se puede editar mientras no esté aprobada, rechazada o anulada. Si ya estaba enviada a aprobación, al guardar vuelve a Borrador y hay que volver a enviarla. Se pueden agregar productos nuevos, pero no quitar los ya existentes."
      />
      <OrdenCompraEditarForm
        ordenId={orden.id}
        categoria={categoria}
        esDirecta={esDirecta}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : undefined,
          condicionPago: p.condicionPago,
        }))}
        items={orden.items.map((item) => ({
          id: item.id,
          codigo: item.sku.codigo,
          descripcion: item.sku.descripcion,
          unidadMedida: item.sku.unidadMedida,
          centroCosto: item.centroCosto,
          campo: item.campo,
        }))}
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida, categoria: s.categoria }))}
        centrosCosto={centrosCosto}
        campos={campos}
        solicitudesPendientes={solicitudesPendientes}
        valoresIniciales={{
          proveedorId: orden.proveedorId,
          fecha: fechaInputValue(orden.fecha),
          hora: orden.hora ?? "",
          fechaEntrega: orden.fechaEntrega ? fechaInputValue(orden.fechaEntrega) : fechaInputValue(new Date()),
          condicionPago: orden.condicionPago ?? "",
          lugarEntrega: orden.lugarEntrega ?? "",
          observaciones: orden.observaciones ?? "",
          moneda: orden.moneda as "PEN" | "USD",
          filas: Object.fromEntries(
            orden.items.map((item) => [
              item.id,
              {
                cantidad: String(Number(item.cantidad)),
                precioUnitario: String(Number(item.precioUnitario)),
                gravado: item.gravado,
                descripcion: item.descripcion ?? "",
              },
            ])
          ),
        }}
        entregasIniciales={Object.fromEntries(
          orden.items.map((item) => [
            item.id,
            item.entregas.map((e) => ({
              cantidad: String(Number(e.cantidad)),
              fechaTentativa: fechaInputValue(e.fechaTentativa),
            })),
          ])
        )}
      />
    </div>
  );
}
