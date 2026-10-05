import Link from "next/link";
import { ShoppingCart, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoneda } from "@/lib/utils";
import { CATEGORIAS_COMPRA } from "@/lib/constants/compras";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea } from "@/lib/compras";
import { OrdenesCompraTable, type FilaOrdenCompra } from "./ordenes-compra-table";
import type { AreaEmpresa } from "@prisma/client";

export default async function OrdenesCompraPage() {
  const [usuario, aprobadores] = await Promise.all([getUsuarioActual(), obtenerAprobadoresArea()]);

  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;
  // Los compradores de Supply Chain gestionan las compras de toda la
  // empresa, y los aprobadores generales (Gerente de Supply, District
  // Controller, Gerencia General) pueden aprobar cualquier OC/OS, así que
  // ambos ven todas, no solo las de su área.
  const esSupplyChain = usuario?.area === "SUPPLY_CHAIN";
  const esAprobadorGeneral = usuario?.roles.includes("APROBADOR_GENERAL") ?? false;
  const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));
  // Igual que en Solicitudes de pedido: todo usuario con área asignada
  // (sea o no aprobador) solo ve las OC/OS que tengan al menos una línea
  // de su propia área; ADMIN, Supply Chain y aprobadores generales ven todas.
  const areaUsuario = usuario && !esAdmin && !esSupplyChain && !esAprobadorGeneral ? usuario.area : null;

  const ordenes = await prisma.ordenCompra.findMany({
    where: areaUsuario ? { items: { some: { centroCosto: areaUsuario as AreaEmpresa } } } : undefined,
    include: { proveedor: true, items: { select: { centroCosto: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const filas: FilaOrdenCompra[] = ordenes.map((orden) => {
    const tienePermisoOrden =
      esAdmin || (!!usuario && orden.items.some((i) => aprobadoresPorArea.get(i.centroCosto) === usuario.id));
    // Antes de aprobada, anular equivale a borrar y lo puede usar
    // cualquiera; ya aprobada, solo ADMIN o el aprobador de alguna de las
    // áreas de la orden.
    const puedeAnular =
      orden.estado === "APROBADO" ? tienePermisoOrden : orden.estado !== "RECHAZADO" && orden.estado !== "ANULADO";
    return {
      id: orden.id,
      numero: orden.numero,
      categoria: orden.categoria as "COMPRA" | "SERVICIO",
      categoriaLabel: CATEGORIAS_COMPRA.find((c) => c.valor === orden.categoria)?.nombre ?? orden.categoria,
      proveedorRazonSocial: orden.proveedor.razonSocial,
      estado: orden.estado,
      fecha: formatDate(orden.fecha),
      subtotal: formatMoneda(orden.subtotal.toString(), orden.moneda),
      igv: formatMoneda(orden.igv.toString(), orden.moneda),
      montoTotal: formatMoneda(orden.montoTotal.toString(), orden.moneda),
      puedeAnular,
    };
  });

  return (
    <div>
      <PageHeader
        titulo="Órdenes de compra"
        descripcion="Órdenes de compra emitidas a proveedores de insumos, generadas a partir de solicitudes de pedido."
        acciones={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/logistica/ordenes-compra/nuevo?categoria=SERVICIO">
                <Plus className="mr-2 h-4 w-4" />
                Nueva de servicio
              </Link>
            </Button>
            <Button asChild>
              <Link href="/logistica/ordenes-compra/nuevo?categoria=COMPRA">
                <Plus className="mr-2 h-4 w-4" />
                Nueva de compra
              </Link>
            </Button>
          </div>
        }
      />

      {ordenes.length === 0 ? (
        <EmptyState
          icono={ShoppingCart}
          titulo="Aún no hay órdenes de compra ni de servicio"
          descripcion="Genera la primera con los botones de arriba, jalando ítems pendientes de una o varias solicitudes de la misma categoría."
        />
      ) : (
        <OrdenesCompraTable filas={filas} />
      )}
    </div>
  );
}
