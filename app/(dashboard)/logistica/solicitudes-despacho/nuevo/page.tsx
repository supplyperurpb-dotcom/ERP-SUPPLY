import { PageHeader } from "@/components/shared/page-header";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerValoresActivos } from "@/lib/listas";
import { calcularStockDisponibleDespacho } from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { prisma } from "@/lib/db/prisma";
import type { AreaEmpresaCodigo } from "@/lib/constants/compras";
import { puedeVerCampoPacking } from "@/lib/compras";
import { SolicitudDespachoForm } from "./solicitud-despacho-form";

export default async function NuevaSolicitudDespachoPage() {
  const usuario = await getUsuarioActual();
  const areaInicial: AreaEmpresaCodigo = (usuario?.area as AreaEmpresaCodigo | null) ?? "PRODUCCION";
  const usuarioNombre = usuario ? `${usuario.nombres} ${usuario.apellidos}` : "—";

  const [stockTotal, existentes, centrosCosto, camposTodos] = await Promise.all([
    calcularStockDisponibleDespacho(),
    prisma.solicitudDespacho.findMany({ select: { numero: true } }),
    obtenerValoresActivos("CENTRO_COSTO"),
    obtenerValoresActivos("CAMPO"),
  ]);
  const numeroTentativo = siguienteNumero(existentes.map((s) => s.numero), "SD-");

  // "Packing" solo lo pueden ver/elegir los compradores y Carlos Gozzer —
  // ver puedeVerCampoPacking.
  const campos = usuario && puedeVerCampoPacking(usuario) ? camposTodos : camposTodos.filter((c) => c !== "Packing");

  return (
    <div>
      <PageHeader
        titulo={`Nueva solicitud de despacho — ${numeroTentativo}`}
        descripcion="Pide que Almacén te despache cierta cantidad de un producto. No necesitas saber de qué almacén sale: eso lo define Almacén al atenderla."
      />
      <SolicitudDespachoForm
        skus={stockTotal.map((s) => ({ id: s.skuId, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida, disponible: s.cantidad }))}
        areaInicial={areaInicial}
        usuarioNombre={usuarioNombre}
        centrosCosto={centrosCosto}
        campos={campos}
      />
    </div>
  );
}
