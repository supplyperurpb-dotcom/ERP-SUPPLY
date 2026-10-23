import { PageHeader } from "@/components/shared/page-header";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerValoresActivos } from "@/lib/listas";
import { calcularStockTotal } from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { prisma } from "@/lib/db/prisma";
import type { AreaEmpresaCodigo } from "@/lib/constants/compras";
import { SolicitudDespachoForm } from "./solicitud-despacho-form";

export default async function NuevaSolicitudDespachoPage() {
  const usuario = await getUsuarioActual();
  const areaInicial: AreaEmpresaCodigo = (usuario?.area as AreaEmpresaCodigo | null) ?? "PRODUCCION";
  // Mismo criterio que Solicitud de Pedido: Supply Chain y ADMIN pueden
  // pedir en nombre de cualquier área; el resto queda fijo en la suya
  // propia (crearSolicitudDespachoAction lo vuelve a forzar en el servidor).
  const areaEditable = !usuario?.area || usuario.area === "SUPPLY_CHAIN" || usuario.roles.includes("ADMIN");

  const [stockTotal, existentes, centrosCosto, campos] = await Promise.all([
    calcularStockTotal(),
    prisma.solicitudDespacho.findMany({ select: { numero: true } }),
    obtenerValoresActivos("CENTRO_COSTO"),
    obtenerValoresActivos("CAMPO"),
  ]);
  const numeroTentativo = siguienteNumero(existentes.map((s) => s.numero), "SD-");

  return (
    <div>
      <PageHeader
        titulo={`Nueva solicitud de despacho — ${numeroTentativo}`}
        descripcion="Pide que Almacén te despache cierta cantidad de un producto. No necesitas saber de qué almacén sale: eso lo define Almacén al atenderla."
      />
      <SolicitudDespachoForm
        skus={stockTotal.map((s) => ({ id: s.skuId, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida, disponible: s.cantidad }))}
        areaInicial={areaInicial}
        areaEditable={areaEditable}
        centrosCosto={centrosCosto}
        campos={campos}
      />
    </div>
  );
}
