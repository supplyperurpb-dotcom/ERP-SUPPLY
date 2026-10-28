import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularSolicitudesConPendientes } from "@/lib/compras";
import { obtenerValoresActivos } from "@/lib/listas";
import { siguienteNumero } from "@/lib/utils";
import { NOMBRE_ORDEN, PREFIJO_ORDEN, type CategoriaCompraCodigo, type TipoOrdenCodigo } from "@/lib/constants/compras";
import { OrdenCompraForm } from "./orden-compra-form";

export default async function NuevaOrdenCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; tipo?: string; solicitudId?: string }>;
}) {
  const { categoria, tipo, solicitudId } = await searchParams;
  const categoriaSeleccionada: CategoriaCompraCodigo = categoria === "SERVICIO" ? "SERVICIO" : "COMPRA";
  const tipoOrden: TipoOrdenCodigo = tipo === "ABIERTA" ? "ABIERTA" : "ESTANDAR";

  const [solicitudes, proveedores, existentes, centrosCosto] = await Promise.all([
    calcularSolicitudesConPendientes(prisma, categoriaSeleccionada),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.ordenCompra.findMany({ where: { categoria: categoriaSeleccionada, tipoOrden }, select: { numero: true } }),
    obtenerValoresActivos("CENTRO_COSTO"),
  ]);
  // Solo un adelanto: el número real se asigna recién al guardar (dentro
  // de la misma transacción) para no pisarse si dos personas crean una
  // orden al mismo tiempo. Si eso llega a pasar, el guardado igual asigna
  // el correlativo correcto aunque no coincida exactamente con este preview.
  const numeroTentativo = siguienteNumero(existentes.map((o) => o.numero), PREFIJO_ORDEN[categoriaSeleccionada][tipoOrden], 9);

  return (
    <div>
      <PageHeader
        titulo={`Nueva ${NOMBRE_ORDEN[categoriaSeleccionada].toLowerCase()} ${tipoOrden === "ABIERTA" ? "abierta" : "estándar"} — ${numeroTentativo}`}
        descripcion="Selecciona ítems pendientes de una o varias solicitudes aprobadas, ingresa precios y genera la orden para un proveedor. Solo se listan solicitudes de esta misma categoría."
      />
      <OrdenCompraForm
        solicitudes={solicitudes}
        categoria={categoriaSeleccionada}
        tipoOrden={tipoOrden}
        solicitudIdInicial={solicitudId}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : "",
          condicionPago: p.condicionPago,
        }))}
        centrosCosto={centrosCosto}
      />
    </div>
  );
}
