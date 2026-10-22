import Link from "next/link";
import { ClipboardList, Plus, Settings, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA } from "@/lib/constants/compras";
import { getUsuarioActual } from "@/lib/auth/session";
import { SolicitudesPedidoTable, type FilaSolicitudPedido } from "./solicitudes-pedido-table";
import type { AreaEmpresa } from "@prisma/client";

export default async function SolicitudesPedidoPage() {
  const usuario = await getUsuarioActual();

  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;
  // Los compradores de Supply Chain gestionan las compras de toda la
  // empresa, y los aprobadores generales (Gerente de Supply, District
  // Controller, Gerencia General) pueden aprobar cualquier solicitud, así
  // que ambos ven todas, no solo las de su área.
  const esSupplyChain = usuario?.area === "SUPPLY_CHAIN";
  const esAprobadorGeneral = usuario?.roles.includes("APROBADOR_GENERAL") ?? false;
  // Todo usuario con área asignada (sea o no aprobador) solo ve las
  // solicitudes de su propia área; ADMIN, Supply Chain y aprobadores
  // generales ven todas.
  const areaUsuario = usuario && !esAdmin && !esSupplyChain && !esAprobadorGeneral ? usuario.area : null;

  const solicitudes = await prisma.solicitudPedido.findMany({
    where: areaUsuario ? { area: areaUsuario as AreaEmpresa } : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Anular es exclusivo de quien tenga el rol ANULADOR, sin importar el
  // estado de la solicitud.
  const puedeAnularGlobal = usuario?.roles.includes("ANULADOR") ?? false;

  const filas: FilaSolicitudPedido[] = solicitudes.map((solicitud) => ({
    id: solicitud.id,
    numero: solicitud.numero,
    categoria: solicitud.categoria as "COMPRA" | "SERVICIO",
    categoriaLabel: CATEGORIAS_COMPRA.find((c) => c.valor === solicitud.categoria)?.nombre ?? solicitud.categoria,
    area: AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area,
    tipoNecesidad: TIPOS_NECESIDAD.find((t) => t.valor === solicitud.tipoNecesidad)?.nombre ?? solicitud.tipoNecesidad,
    fecha: formatDate(solicitud.fecha),
    fechaNecesidad: formatDate(solicitud.fechaNecesidad),
    estado: solicitud.estado,
    numItems: solicitud._count.items,
    puedeAnular: puedeAnularGlobal && solicitud.estado !== "RECHAZADO" && solicitud.estado !== "ANULADO",
  }));

  return (
    <div>
      <PageHeader
        titulo="Solicitudes de pedido"
        descripcion="Solicitudes internas de compra de insumos y materiales, punto de partida del flujo de abastecimiento hacia las órdenes de compra. Entra a cada solicitud para aprobar o rechazar sus productos."
        acciones={
          <div className="flex gap-2">
            {esAdmin && (
              <Button variant="outline" asChild>
                <Link href="/logistica/solicitudes-pedido/aprobadores">
                  <Settings className="mr-2 h-4 w-4" />
                  Aprobadores por área
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild title="Descargar Excel con el detalle de todas las solicitudes">
              <a href="/api/excel/solicitudes-pedido">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Descargar Excel
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/logistica/solicitudes-pedido/nuevo?categoria=SERVICIO">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Servicio
              </Link>
            </Button>
            <Button asChild>
              <Link href="/logistica/solicitudes-pedido/nuevo?categoria=COMPRA">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Compra
              </Link>
            </Button>
          </div>
        }
      />

      {solicitudes.length === 0 ? (
        <EmptyState
          icono={ClipboardList}
          titulo="Aún no hay solicitudes de pedido"
          descripcion="Registra la primera solicitud con los botones de arriba."
        />
      ) : (
        <SolicitudesPedidoTable filas={filas} />
      )}
    </div>
  );
}
