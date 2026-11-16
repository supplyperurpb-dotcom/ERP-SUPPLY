import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatCantidad } from "@/lib/utils";
import { AnadirItemsDialog, type ItemOcDisponible } from "./anadir-items-dialog";
import { TablaAvanceItems, type FilaAvanceItem } from "./tabla-avance-items";

// "Avance OS {numero}": seguimiento de ejecución de una orden de servicio
// ya aprobada (ver ServicioGestionado) — items que alguien eligió a
// propósito seguir ("Añadir Items") y, por cada uno, un registro
// incremental de avance (por % o por cantidad) contra su saldo pendiente.
// `id` acá es el id de la OrdenCompra (mismo que usa la lista de Gestión
// de Servicios), no el de ServicioGestionado.
export default async function AvanceOsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const servicio = await prisma.servicioGestionado.findUnique({
    where: { ordenCompraId: id },
    include: {
      ordenCompra: { include: { proveedor: true, items: { include: { sku: true } } } },
      items: { include: { ordenCompraItem: { include: { sku: true } }, avances: true } },
    },
  });

  if (!servicio) notFound();

  const idsYaAgregados = new Set(servicio.items.map((i) => i.ordenCompraItemId));
  const itemsDisponibles: ItemOcDisponible[] = servicio.ordenCompra.items
    .filter((item) => !idsYaAgregados.has(item.id))
    .map((item) => ({
      id: item.id,
      codigo: item.sku.codigo,
      descripcion: item.descripcion || item.sku.descripcion,
      cantidad: `${formatCantidad(Number(item.cantidad))} ${item.sku.unidadMedida}`,
    }));

  const filasAvance: FilaAvanceItem[] = servicio.items.map((itemGestionado) => {
    const cantidadTotal = Number(itemGestionado.ordenCompraItem.cantidad);
    const valorTotal = Number(itemGestionado.ordenCompraItem.subtotal);
    const cantidadAvanzada = itemGestionado.avances.reduce((acc, a) => acc + Number(a.cantidad), 0);
    const valorAvanzado = itemGestionado.avances.reduce((acc, a) => acc + Number(a.valorizado), 0);
    return {
      itemServicioGestionadoId: itemGestionado.id,
      codigo: itemGestionado.ordenCompraItem.sku.codigo,
      descripcion: itemGestionado.ordenCompraItem.descripcion || itemGestionado.ordenCompraItem.sku.descripcion,
      unidadMedida: itemGestionado.ordenCompraItem.sku.unidadMedida,
      cantidadTotal,
      precioUnitario: Number(itemGestionado.ordenCompraItem.precioUnitario),
      moneda: servicio.ordenCompra.moneda,
      saldoCantidad: cantidadTotal - cantidadAvanzada,
      saldoValor: valorTotal - valorAvanzado,
    };
  });

  return (
    <div>
      <Link href="/logistica/gestion-servicios" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Volver a Gestión de Servicios
      </Link>

      <PageHeader
        titulo={`Avance OS ${servicio.ordenCompra.numero}`}
        descripcion={servicio.ordenCompra.proveedor.razonSocial}
        acciones={<AnadirItemsDialog servicioGestionadoId={servicio.id} items={itemsDisponibles} />}
      />

      <TablaAvanceItems filas={filasAvance} />
    </div>
  );
}
