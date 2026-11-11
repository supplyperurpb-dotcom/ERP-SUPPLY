import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerValoresActivos } from "@/lib/listas";
import { siguienteNumero } from "@/lib/utils";
import {
  NOMBRE_SOLICITUD,
  PREFIJO_SOLICITUD,
  areasDeGerenciaSolped,
  type CategoriaCompraCodigo,
  type GerenciaSolpedCodigo,
} from "@/lib/constants/compras";
import { SolicitudPedidoForm } from "./solicitud-pedido-form";

export default async function NuevaSolicitudPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const categoriaInicial: CategoriaCompraCodigo = categoria === "SERVICIO" ? "SERVICIO" : "COMPRA";

  const usuario = await getUsuarioActual();
  const areaInicial: GerenciaSolpedCodigo = (usuario?.area as GerenciaSolpedCodigo | null) ?? "PRODUCCION";
  // No se guarda el Área puntual del usuario (solo su Gerencia, ver
  // Usuario.area): se arranca con la primera Área de su Gerencia y puede
  // cambiarla libremente dentro de ella (ver areaEditable más abajo, que
  // solo controla si puede cambiar de Gerencia).
  const areaDetalleInicial = areasDeGerenciaSolped(areaInicial)[0]?.valor ?? "COMPRAS";
  // Supply Chain gestiona pedidos de cualquier área en nombre de otros, así
  // que a ellos (y a un ADMIN) se les deja elegir; el resto queda fijo en
  // la suya propia (ver también crearSolicitudPedidoAction, que la vuelve a
  // forzar en el servidor por si se manipula el valor enviado).
  const areaEditable = !usuario?.area || usuario.area === "SUPPLY_CHAIN" || usuario.roles.includes("ADMIN");

  // En SERVICIO, el catálogo son solo los SKU de Servicios (uno por
  // subfamilia, p. ej. "Apicultura"); en COMPRA se excluyen esos SKU. El
  // Área puede acotar más ese catálogo de Compra (ver skuPermitidoParaAreaSolped
  // en solicitud-pedido-form.tsx) — por eso se trae categoria/subfamilia.
  const [skus, existentes, centrosCosto, campos] = await Promise.all([
    prisma.sku.findMany({
      where: {
        activo: true,
        categoria: categoriaInicial === "SERVICIO" ? "Servicios" : { not: "Servicios" },
      },
      orderBy: { codigo: "asc" },
    }),
    prisma.solicitudPedido.findMany({ where: { categoria: categoriaInicial }, select: { numero: true } }),
    obtenerValoresActivos("CENTRO_COSTO"),
    obtenerValoresActivos("CAMPO"),
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
        skus={skus.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          descripcion: s.descripcion,
          unidadMedida: s.unidadMedida,
          categoria: s.categoria,
          subfamilia: s.subfamilia,
        }))}
        categoriaInicial={categoriaInicial}
        areaInicial={areaInicial}
        areaDetalleInicial={areaDetalleInicial}
        areaEditable={areaEditable}
        centrosCosto={centrosCosto}
        campos={campos}
      />
    </div>
  );
}
