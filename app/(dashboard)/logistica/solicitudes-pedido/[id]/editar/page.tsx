import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerValoresActivos } from "@/lib/listas";
import { fechaInputValue } from "@/lib/utils";
import { NOMBRE_SOLICITUD, type CategoriaCompraCodigo, type AreaEmpresaCodigo } from "@/lib/constants/compras";
import { SolicitudPedidoForm } from "../../nuevo/solicitud-pedido-form";

export default async function EditarSolicitudPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const solicitud = await prisma.solicitudPedido.findUnique({
    where: { id },
    include: {
      items: { include: { ordenCompraItems: { include: { ordenCompra: true } } } },
    },
  });
  if (!solicitud) notFound();

  const usuario = await getUsuarioActual();
  // Mismo criterio que editarSolicitudPedidoAction: quien la creó, o
  // Supply Chain/ADMIN (gestionan pedidos de cualquier área). Si no puede
  // editar o ya fue jalada por una OC/OS activa, no hay nada que mostrar
  // acá (el botón "Editar" tampoco aparece en el detalle en ese caso).
  const puedeEditar =
    !!usuario &&
    solicitud.estado !== "RECHAZADO" &&
    solicitud.estado !== "ANULADO" &&
    (usuario.roles.includes("ADMIN") || usuario.area === "SUPPLY_CHAIN" || solicitud.creadoPorId === usuario.id);
  const fueJalada = solicitud.items.some((item) =>
    item.ordenCompraItems.some((oci) => oci.ordenCompra.estado !== "RECHAZADO" && oci.ordenCompra.estado !== "ANULADO")
  );
  if (!puedeEditar || fueJalada) notFound();

  const categoria = solicitud.categoria as CategoriaCompraCodigo;
  const areaEditable = !usuario.area || usuario.area === "SUPPLY_CHAIN" || usuario.roles.includes("ADMIN");

  const [skus, centrosCosto, campos] = await Promise.all([
    prisma.sku.findMany({
      where: { activo: true, categoria: categoria === "SERVICIO" ? "Servicios" : { not: "Servicios" } },
      orderBy: { codigo: "asc" },
    }),
    obtenerValoresActivos("CENTRO_COSTO"),
    obtenerValoresActivos("CAMPO"),
  ]);

  // Líneas con CUALQUIER historial de OC/OS (aunque esté anulada) no se
  // pueden quitar del formulario — ver editarSolicitudPedidoAction.
  const itemsNoEliminables = new Set(
    solicitud.items.filter((item) => item.ordenCompraItems.length > 0).map((item) => item.id)
  );

  return (
    <div>
      <PageHeader
        titulo={`Editar ${NOMBRE_SOLICITUD[categoria].toLowerCase()} — ${solicitud.numero}`}
        descripcion="Solo se puede editar mientras no se haya generado una orden de compra/servicio activa con sus productos."
      />
      <SolicitudPedidoForm
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        categoriaInicial={categoria}
        areaInicial={solicitud.area as AreaEmpresaCodigo}
        areaEditable={areaEditable}
        centrosCosto={centrosCosto}
        campos={campos}
        solicitudId={solicitud.id}
        itemsNoEliminables={itemsNoEliminables}
        advertenciaReinicioAprobacion={solicitud.estado === "APROBADO"}
        valoresIniciales={{
          fecha: fechaInputValue(solicitud.fecha),
          fechaNecesidad: fechaInputValue(solicitud.fechaNecesidad),
          tipoNecesidad: solicitud.tipoNecesidad,
          justificacion: solicitud.justificacion ?? "",
          items: solicitud.items.map((item) => ({
            id: item.id,
            skuId: item.skuId,
            cantidad: Number(item.cantidad),
            unidadMedida: item.unidadMedida,
            centroCosto: item.centroCosto,
            descripcion: item.descripcion ?? "",
            campo: item.campo ?? "",
          })),
        }}
      />
    </div>
  );
}
