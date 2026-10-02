import Link from "next/link";
import { ClipboardList, Plus, FileDown, Settings, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AprobarRechazarBotones, AnularSolicitudBoton } from "./aprobar-rechazar-botones";
import { formatDate } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA } from "@/lib/constants/compras";
import { getUsuarioActual } from "@/lib/auth/session";
import { obtenerAprobadoresArea, puedeAprobarSolicitud } from "@/lib/compras";
import type { EstadoDocumento, AreaEmpresa } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ANULADO: "Anulada",
};

const ESTADO_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

export default async function SolicitudesPedidoPage() {
  const [usuario, aprobadores] = await Promise.all([getUsuarioActual(), obtenerAprobadoresArea()]);

  const esAdmin = usuario?.roles.includes("ADMIN") ?? false;
  // Los compradores de Supply Chain gestionan las compras de toda la
  // empresa, así que ven todas las solicitudes, no solo las de su área.
  const esSupplyChain = usuario?.area === "SUPPLY_CHAIN";
  const puedeGenerarOrden = esAdmin || esSupplyChain;
  const aprobadoresPorArea = new Map(aprobadores.map((a) => [a.area, a.usuarioId]));
  // Todo usuario con área asignada (sea o no aprobador) solo ve las
  // solicitudes de su propia área; ADMIN y Supply Chain ven todas.
  const areaUsuario = usuario && !esAdmin && !esSupplyChain ? usuario.area : null;

  const solicitudes = await prisma.solicitudPedido.findMany({
    where: areaUsuario ? { area: areaUsuario as AreaEmpresa } : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        titulo="Solicitudes de pedido"
        descripcion="Solicitudes internas de compra de insumos y materiales, punto de partida del flujo de abastecimiento hacia las órdenes de compra. Solo las solicitudes aprobadas por el responsable del área pueden jalarse hacia una orden de compra."
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
            <Button variant="outline" asChild>
              <Link href="/logistica/solicitudes-pedido/nuevo?categoria=SERVICIO">
                <Plus className="mr-2 h-4 w-4" />
                Nueva de servicio
              </Link>
            </Button>
            <Button asChild>
              <Link href="/logistica/solicitudes-pedido/nuevo?categoria=COMPRA">
                <Plus className="mr-2 h-4 w-4" />
                Nueva de compra
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Fecha necesidad</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">N.º de ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solicitudes.map((solicitud) => {
              const tienePermisoArea =
                !!usuario &&
                puedeAprobarSolicitud({
                  usuarioId: usuario.id,
                  roles: usuario.roles,
                  area: solicitud.area,
                  aprobadoresPorArea,
                });
              const puedeAprobar = solicitud.estado === "PENDIENTE" && tienePermisoArea;
              // Antes de aprobada, anular equivale a borrar y lo puede usar
              // cualquiera; ya aprobada, solo el aprobador del área.
              const puedeAnular =
                solicitud.estado === "APROBADO"
                  ? tienePermisoArea
                  : solicitud.estado !== "RECHAZADO" && solicitud.estado !== "ANULADO";
              return (
                <TableRow key={solicitud.id}>
                  <TableCell className="font-medium">{solicitud.numero}</TableCell>
                  <TableCell>
                    <Badge variant={solicitud.categoria === "SERVICIO" ? "secondary" : "success"}>
                      {CATEGORIAS_COMPRA.find((c) => c.valor === solicitud.categoria)?.nombre ?? solicitud.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell>{AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area}</TableCell>
                  <TableCell>
                    {TIPOS_NECESIDAD.find((t) => t.valor === solicitud.tipoNecesidad)?.nombre ?? solicitud.tipoNecesidad}
                  </TableCell>
                  <TableCell>{formatDate(solicitud.fecha)}</TableCell>
                  <TableCell>{formatDate(solicitud.fechaNecesidad)}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[solicitud.estado]}>{ESTADO_LABEL[solicitud.estado]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{solicitud._count.items}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {puedeAprobar && <AprobarRechazarBotones id={solicitud.id} numero={solicitud.numero} />}
                      {puedeAnular && <AnularSolicitudBoton id={solicitud.id} numero={solicitud.numero} />}
                      <Button variant="outline" size="sm" asChild title="Vista previa en PDF">
                        <a href={`/api/pdf/solicitud-pedido/${solicitud.id}`} target="_blank" rel="noopener noreferrer">
                          <FileDown className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/logistica/solicitudes-pedido/${solicitud.id}`}>Ver</Link>
                      </Button>
                      {puedeGenerarOrden && solicitud.estado === "APROBADO" && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/logistica/ordenes-compra/nuevo?categoria=${solicitud.categoria}&solicitudId=${solicitud.id}`}
                          >
                            <ShoppingCart className="mr-1 h-4 w-4" />
                            Generar {solicitud.categoria === "SERVICIO" ? "OS" : "OC"}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
