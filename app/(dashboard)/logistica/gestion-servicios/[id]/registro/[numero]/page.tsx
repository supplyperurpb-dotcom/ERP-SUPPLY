import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatCantidad, formatDateTime } from "@/lib/utils";
import { getUsuarioActual } from "@/lib/auth/session";
import { esComprador } from "@/lib/compras";
import { AnadirItemsDialog, type ItemOcDisponible } from "./anadir-items-dialog";
import { TablaAvanceItems, type FilaAvanceItem } from "./tabla-avance-items";
import { SustentosSection, type SustentoGuardado } from "./sustentos-section";
import { CulminarRegistroBoton } from "./culminar-registro-boton";
import { SolicitarVbDialog, type UsuarioOpcion } from "./solicitar-vb-dialog";

const ESTADO_LABEL = {
  ABIERTO: "Abierto",
  CULMINADO: "Culminado",
  PENDIENTE_VB: "Pendiente de VB",
  APROBADO: "Aprobado",
  APROBADO_PARCIAL: "Aprobado Parcial",
  RECHAZADO: "Rechazado",
} as const;

const ESTADO_VARIANT = {
  ABIERTO: "secondary",
  CULMINADO: "secondary",
  PENDIENTE_VB: "secondary",
  APROBADO: "success",
  APROBADO_PARCIAL: "warning",
  RECHAZADO: "destructive",
} as const;

// "OS {número} - Registro de Avance {N}": acá viven "Añadir Items", la
// tabla de avance, "Sustento" y, según el estado (ver
// EstadoRegistroAvance), "Culminar Registro" / "Solicitar VB" / la
// decisión del VB. El saldo de cada línea considera los avances de TODOS
// sus registros, no solo este — ver [id]/page.tsx para la landing.
export default async function RegistroAvancePage({ params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero: numeroParam } = await params;
  const numero = Number(numeroParam);

  const usuario = await getUsuarioActual();
  const servicio = await prisma.servicioGestionado.findUnique({
    where: { ordenCompraId: id },
    include: { ordenCompra: { include: { items: { include: { sku: true } } } } },
  });
  if (!servicio || !Number.isInteger(numero)) notFound();

  const registro = await prisma.registroAvance.findUnique({
    where: { servicioGestionadoId_numero: { servicioGestionadoId: servicio.id, numero } },
    include: {
      items: { include: { ordenCompraItem: { include: { sku: true } } } },
      sustentos: { orderBy: { numero: "asc" } },
    },
  });
  if (!registro) notFound();

  // Avance acumulado real de cada línea de la OC, sumando sus avances a
  // través de TODOS los registros (no solo este).
  const ordenCompraItemIds = servicio.ordenCompra.items.map((i) => i.id);
  const todosLosItemsDeEstaOs =
    ordenCompraItemIds.length > 0
      ? await prisma.itemRegistroAvance.findMany({
          where: { ordenCompraItemId: { in: ordenCompraItemIds } },
          include: { avances: true },
        })
      : [];
  const acumuladoPorItem = new Map<string, { cantidad: number; valorizado: number }>();
  for (const itemGestionado of todosLosItemsDeEstaOs) {
    const actual = acumuladoPorItem.get(itemGestionado.ordenCompraItemId) ?? { cantidad: 0, valorizado: 0 };
    for (const avance of itemGestionado.avances) {
      actual.cantidad += Number(avance.cantidad);
      actual.valorizado += Number(avance.valorizado);
    }
    acumuladoPorItem.set(itemGestionado.ordenCompraItemId, actual);
  }

  const soloLectura = registro.estado !== "ABIERTO";

  const idsYaEnEsteRegistro = new Set(registro.items.map((i) => i.ordenCompraItemId));
  const itemsDisponibles: ItemOcDisponible[] = soloLectura
    ? []
    : servicio.ordenCompra.items
        .filter((item) => !idsYaEnEsteRegistro.has(item.id))
        .filter((item) => Number(item.cantidad) - (acumuladoPorItem.get(item.id)?.cantidad ?? 0) > 0.001)
        .map((item) => ({
          id: item.id,
          codigo: item.sku.codigo,
          descripcion: item.descripcion || item.sku.descripcion,
          cantidad: `${formatCantidad(Number(item.cantidad))} ${item.sku.unidadMedida}`,
        }));

  const filasAvance: FilaAvanceItem[] = registro.items.map((itemGestionado) => {
    const cantidadTotal = Number(itemGestionado.ordenCompraItem.cantidad);
    const valorTotal = Number(itemGestionado.ordenCompraItem.subtotal);
    const acumulado = acumuladoPorItem.get(itemGestionado.ordenCompraItemId) ?? { cantidad: 0, valorizado: 0 };
    return {
      itemRegistroAvanceId: itemGestionado.id,
      codigo: itemGestionado.ordenCompraItem.sku.codigo,
      descripcion: itemGestionado.ordenCompraItem.descripcion || itemGestionado.ordenCompraItem.sku.descripcion,
      unidadMedida: itemGestionado.ordenCompraItem.sku.unidadMedida,
      cantidadTotal,
      precioUnitario: Number(itemGestionado.ordenCompraItem.precioUnitario),
      moneda: servicio.ordenCompra.moneda,
      saldoCantidad: cantidadTotal - acumulado.cantidad,
      saldoValor: valorTotal - acumulado.valorizado,
      estadoVB: itemGestionado.estadoVB,
      observacionesVB: itemGestionado.observacionesVB,
    };
  });

  const sustentos: SustentoGuardado[] = registro.sustentos.map((s) => ({
    id: s.id,
    numero: s.numero,
    descripcion: s.descripcion,
    nombreArchivo: s.nombreArchivo,
  }));

  let usuariosParaVb: UsuarioOpcion[] = [];
  if (registro.estado === "CULMINADO") {
    const usuarios = await prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombres: "asc" } });
    usuariosParaVb = usuarios.map((u) => ({ id: u.id, nombreCompleto: `${u.nombres} ${u.apellidos}` }));
  }

  // Puede decidir/revertir: el aprobador asignado (o ADMIN), en cualquier
  // estado posterior a CULMINADO — una línea RECHAZADA se puede revertir
  // a APROBADO aunque el registro ya no esté PENDIENTE_VB (ver
  // decidirVbItemAction).
  const puedeDecidirVb =
    !!usuario &&
    registro.estado !== "ABIERTO" &&
    registro.estado !== "CULMINADO" &&
    (registro.aprobadorId === usuario.id || usuario.roles.includes("ADMIN"));
  const mostrarVb = registro.estado !== "ABIERTO" && registro.estado !== "CULMINADO";
  // Comprador: puede "Editar" cualquier línea (aprobada, rechazada o
  // pendiente) una vez pasado ABIERTO, sin pedir VB de nuevo para todo el
  // registro (ver reabrirItemParaEdicionAction).
  const puedeEditar = !!usuario && esComprador(usuario);

  return (
    <div>
      <Link
        href={`/logistica/gestion-servicios/${id}`}
        className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver a Avance OS
      </Link>

      <PageHeader
        titulo={`OS ${servicio.ordenCompra.numero} - Registro de Avance ${numero}`}
        descripcion={registro.fechaDecision ? `Resuelto el ${formatDateTime(registro.fechaDecision)}` : undefined}
        acciones={
          <div className="flex items-center gap-2">
            <Badge variant={ESTADO_VARIANT[registro.estado]}>{ESTADO_LABEL[registro.estado]}</Badge>
            {registro.estado === "ABIERTO" && <AnadirItemsDialog registroAvanceId={registro.id} items={itemsDisponibles} />}
            {registro.estado === "ABIERTO" && <CulminarRegistroBoton registroAvanceId={registro.id} />}
            {registro.estado === "CULMINADO" && <SolicitarVbDialog registroAvanceId={registro.id} usuarios={usuariosParaVb} />}
          </div>
        }
      />

      <TablaAvanceItems
        filas={filasAvance}
        soloLectura={soloLectura}
        mostrarVb={mostrarVb}
        puedeDecidirVb={puedeDecidirVb}
        puedeEditar={puedeEditar}
      />

      <SustentosSection registroAvanceId={registro.id} sustentos={sustentos} soloLectura={soloLectura} />
    </div>
  );
}
