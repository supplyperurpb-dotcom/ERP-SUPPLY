import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoAlmacenForm } from "../../nuevo/ingreso-almacen-form";
import type { IngresoAlmacenInput } from "@/lib/validations/almacen";

export default async function EditarIngresoAlmacenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [ingreso, almacenes, proveedores, skus] = await Promise.all([
    prisma.ingresoAlmacen.findUnique({ where: { id }, include: { items: true } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);
  if (!ingreso) notFound();

  const valoresIniciales: IngresoAlmacenInput = {
    fecha: ingreso.fecha.toISOString().slice(0, 10) as unknown as Date,
    ocNumero: ingreso.ocNumero ?? "",
    moneda: ingreso.moneda as "PEN" | "USD",
    guiaRemision: ingreso.guiaRemision ?? "",
    remitenteRuc: ingreso.remitenteRuc ?? "",
    remitente: ingreso.remitente ?? "",
    flete: ingreso.flete !== null ? Number(ingreso.flete) : 0,
    proveedorId: ingreso.proveedorId ?? "",
    almacenId: ingreso.almacenId,
    observaciones: ingreso.observaciones ?? "",
    items: ingreso.items.map((item) => ({
      skuId: item.skuId,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
      precioUnitario: Number(item.precioUnitario),
      lote: item.lote ?? "",
    })),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar ingreso ${ingreso.numero}`}
        descripcion="Modifica los datos de este ingreso. El stock y el costeo del almacén se recalculan al guardar."
      />
      <IngresoAlmacenForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : "",
        }))}
        skus={skus.map((s) => ({ id: s.id, codigo: s.codigo, descripcion: s.descripcion, unidadMedida: s.unidadMedida }))}
        edicion={{ id: ingreso.id, valoresIniciales }}
      />
    </div>
  );
}
