import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { cantidadPendienteIngresoOC } from "@/lib/stock-almacen";
import { IngresoAlmacenForm } from "../../nuevo/ingreso-almacen-form";

export default async function EditarIngresoAlmacenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ingreso = await prisma.ingresoAlmacen.findUnique({
    where: { id },
    include: {
      almacen: true,
      ordenCompra: { include: { proveedor: true } },
      items: { include: { sku: true, ordenCompraItem: true } },
    },
  });
  if (!ingreso) notFound();

  if (!ingreso.ordenCompra) {
    return (
      <div>
        <PageHeader titulo={`Editar ingreso ${ingreso.numero}`} />
        <p className="text-sm text-muted-foreground">
          Este ingreso se registró antes del nuevo flujo basado en órdenes de compra y ya no se puede editar aquí.
          Si necesitas corregirlo, elimínalo desde su detalle y regístralo de nuevo con la OC correspondiente.
        </p>
      </div>
    );
  }

  const filas = await Promise.all(
    ingreso.items.map(async (item) => {
      const pendienteActual = item.ordenCompraItemId ? await cantidadPendienteIngresoOC(item.ordenCompraItemId) : 0;
      return {
        id: item.ordenCompraItemId!,
        skuId: item.skuId,
        codigo: item.sku.codigo,
        descripcion: item.sku.descripcion,
        unidadMedida: item.unidadMedida,
        precioUnitario: Number(item.precioUnitario),
        cantidadOc: item.ordenCompraItem ? Number(item.ordenCompraItem.cantidad) : Number(item.cantidad),
        // Lo pendiente "visible" en edición es lo pendiente real más lo que
        // este mismo ingreso ya había tomado (que se libera al editar).
        cantidadPendiente: Math.round((pendienteActual + Number(item.cantidad)) * 1000) / 1000,
        cantidad: String(Number(item.cantidad)),
        lote: item.lote ?? "",
        fechaProduccion: item.fechaProduccion ? item.fechaProduccion.toISOString().slice(0, 10) : "",
        fechaVencimiento: item.fechaVencimiento ? item.fechaVencimiento.toISOString().slice(0, 10) : "",
      };
    })
  );

  return (
    <div>
      <PageHeader
        titulo={`Editar ingreso ${ingreso.numero}`}
        descripcion="Modifica la cantidad recibida, el lote/fechas, la guía de remisión o el flete. El stock y el costeo del almacén se recalculan al guardar."
      />
      <IngresoAlmacenForm
        almacenes={[{ id: ingreso.almacen.id, nombre: ingreso.almacen.nombre, categoriaGeneral: ingreso.almacen.categoriaGeneral }]}
        ordenesCompra={[]}
        edicion={{
          id: ingreso.id,
          almacenId: ingreso.almacenId,
          ordenCompra: {
            id: ingreso.ordenCompra.id,
            numero: ingreso.ordenCompra.numero,
            moneda: ingreso.ordenCompra.moneda,
            proveedorRazonSocial: ingreso.ordenCompra.proveedor.razonSocial,
            proveedorRuc:
              ingreso.ordenCompra.proveedor.tipoDocumento === "RUC" ? ingreso.ordenCompra.proveedor.numeroDocumento : "",
            items: [],
          },
          fecha: ingreso.fecha.toISOString().slice(0, 10),
          guiaRemision: ingreso.guiaRemision ?? "",
          flete: ingreso.flete !== null ? String(Number(ingreso.flete)) : "0",
          observaciones: ingreso.observaciones ?? "",
          filas,
        }}
      />
    </div>
  );
}
