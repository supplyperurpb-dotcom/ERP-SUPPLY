import { PageHeader } from "@/components/shared/page-header";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerValoresActivos } from "@/lib/listas";
import { calcularStockDisponibleDespacho, calcularStockPorAreaParaDespacho } from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { prisma } from "@/lib/db/prisma";
import {
  skuPermitidoParaAreaSolped,
  areasDeGerenciaSolped,
  type AreaEmpresaCodigo,
  type AreaSolpedCodigo,
  type GerenciaSolpedCodigo,
} from "@/lib/constants/compras";
import { puedeVerCampoPacking } from "@/lib/compras";
import { SolicitudDespachoForm } from "./solicitud-despacho-form";

export default async function NuevaSolicitudDespachoPage() {
  const usuario = await getUsuarioActual();
  const areaInicial: AreaEmpresaCodigo = (usuario?.area as AreaEmpresaCodigo | null) ?? "PRODUCCION";
  const usuarioNombre = usuario ? `${usuario.nombres} ${usuario.apellidos}` : "—";

  // Misma resolución que usuarios/[id]/editar/page.tsx: si todavía no
  // tiene Área puntual asignada, se cae a la primera de su Gerencia.
  const gerenciaUsuario = (usuario?.area as GerenciaSolpedCodigo | null) ?? "PRODUCCION";
  const areaDetalleUsuario: AreaSolpedCodigo =
    (usuario?.areaDetalle as AreaSolpedCodigo | null) ?? (areasDeGerenciaSolped(gerenciaUsuario)[0]?.valor as AreaSolpedCodigo) ?? "PRODUCCION_1";

  const [stockTotal, stockPorAreaSinFiltrar, existentes, centrosCosto, camposTodos] = await Promise.all([
    calcularStockDisponibleDespacho(),
    calcularStockPorAreaParaDespacho(),
    prisma.solicitudDespacho.findMany({ select: { numero: true } }),
    obtenerValoresActivos("CENTRO_COSTO"),
    obtenerValoresActivos("CAMPO"),
  ]);
  const numeroTentativo = siguienteNumero(existentes.map((s) => s.numero), "SD-");

  // Misma regla de categoría-por-área que Solped (ver
  // skuPermitidoParaAreaSolped): algunas áreas solo ven Suministros,
  // otras también Agroquímicos/Fertilizantes, etc.
  const stockPorArea = stockPorAreaSinFiltrar.filter((fila) => skuPermitidoParaAreaSolped(fila, areaDetalleUsuario));

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
        stockPorArea={stockPorArea.map((f) => ({
          skuId: f.skuId,
          codigo: f.codigo,
          descripcion: f.descripcion,
          unidadMedida: f.unidadMedida,
          areaDetalle: f.areaDetalle,
          cantidad: f.cantidad,
        }))}
        areaDetalleUsuario={areaDetalleUsuario}
        areaInicial={areaInicial}
        usuarioNombre={usuarioNombre}
        centrosCosto={centrosCosto}
        campos={campos}
      />
    </div>
  );
}
