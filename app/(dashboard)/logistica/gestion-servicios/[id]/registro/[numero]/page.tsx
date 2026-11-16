import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatCantidad } from "@/lib/utils";
import { AnadirItemsDialog, type ItemOcDisponible } from "./anadir-items-dialog";
import { TablaAvanceItems, type FilaAvanceItem } from "./tabla-avance-items";

// "OS {número} - Registro de Avance {N}": acá viven "Añadir Items" y la
// tabla de avance de ESTA sesión puntual (ver [id]/page.tsx para la
// landing con "Registrar Avance"/"Anterior"). El saldo de cada línea
// considera los avances de TODOS sus registros, no solo este — una
// misma línea de la OC puede añadirse en varios registros a lo largo del
// tiempo hasta agotar su saldo.
export default async function RegistroAvancePage({ params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero: numeroParam } = await params;
  const numero = Number(numeroParam);

  const servicio = await prisma.servicioGestionado.findUnique({
    where: { ordenCompraId: id },
    include: { ordenCompra: { include: { items: { include: { sku: true } } } } },
  });
  if (!servicio || !Number.isInteger(numero)) notFound();

  const registro = await prisma.registroAvance.findUnique({
    where: { servicioGestionadoId_numero: { servicioGestionadoId: servicio.id, numero } },
    include: { items: { include: { ordenCompraItem: { include: { sku: true } } } } },
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

  const idsYaEnEsteRegistro = new Set(registro.items.map((i) => i.ordenCompraItemId));
  const itemsDisponibles: ItemOcDisponible[] = servicio.ordenCompra.items
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
    };
  });

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
        acciones={<AnadirItemsDialog registroAvanceId={registro.id} items={itemsDisponibles} />}
      />

      <TablaAvanceItems filas={filasAvance} />
    </div>
  );
}
