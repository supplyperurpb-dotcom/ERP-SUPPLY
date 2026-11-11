import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DevolucionAlmacenForm } from "../../nuevo/devolucion-almacen-form";
import type { DevolucionAlmacenInput } from "@/lib/validations/devolucion-almacen";

export default async function EditarDevolucionAlmacenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [devolucion, almacenes, proveedores, retiradores, skus] = await Promise.all([
    prisma.devolucionAlmacen.findUnique({ where: { id }, include: { items: true } }),
    prisma.almacen.findMany({ where: { activo: true, esGeneral: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.retiradorAutorizado.findMany({
      where: { activo: true },
      include: { almacenesPermitidos: true },
      orderBy: { apellidos: "asc" },
    }),
    prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
  ]);
  if (!devolucion) notFound();

  // "Usuario que hizo la devolución" muestra siempre a quien la registró
  // originalmente (creadoPorId no se vuelve a tocar al editar, ver
  // actualizarDevolucionAlmacenAction) — no a quien la está editando ahora.
  const registradoPor = devolucion.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: devolucion.creadoPorId }, select: { nombres: true, apellidos: true } })
    : null;

  const valoresIniciales: DevolucionAlmacenInput = {
    fecha: devolucion.fecha.toISOString().slice(0, 10) as unknown as Date,
    almacenId: devolucion.almacenId,
    // El enum AreaEmpresa ahora también incluye CALIDAD_E_INOCUIDAD (solo
    // seleccionable como Gerencia de una Solped — ver GERENCIAS_SOLPED); el
    // formulario de Devolución de almacén sigue sin ofrecerla.
    area: devolucion.area as DevolucionAlmacenInput["area"],
    personaQueTrae: devolucion.personaQueTrae,
    personaQueTraeDni: devolucion.personaQueTraeDni,
    tieneProveedor: devolucion.proveedorId !== null,
    proveedorId: devolucion.proveedorId ?? "",
    observaciones: devolucion.observaciones ?? "",
    items: devolucion.items.map((item) => ({
      skuId: item.skuId,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
      noValorado: item.noValorado,
      lote: item.lote ?? "",
      fechaProduccion: item.fechaProduccion ? (item.fechaProduccion.toISOString().slice(0, 10) as unknown as Date) : undefined,
      fechaVencimiento: item.fechaVencimiento ? (item.fechaVencimiento.toISOString().slice(0, 10) as unknown as Date) : undefined,
    })),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar devolución ${devolucion.numero}`}
        descripcion="Modifica los datos de esta devolución. El stock del almacén se recalcula al guardar."
      />
      <DevolucionAlmacenForm
        usuario={
          registradoPor ? { nombres: registradoPor.nombres, apellidos: registradoPor.apellidos } : { nombres: "—", apellidos: "" }
        }
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))}
        proveedores={proveedores.map((p) => ({ id: p.id, razonSocial: p.razonSocial, ruc: p.numeroDocumento }))}
        retiradores={retiradores.map((r) => ({
          id: r.id,
          nombreCompleto: `${r.nombres} ${r.apellidos}`,
          dni: r.dni,
          almacenesIds: r.almacenesPermitidos.map((p) => p.almacenId),
        }))}
        skus={skus.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          descripcion: s.descripcion,
          subfamilia: s.subfamilia,
          unidadMedida: s.unidadMedida,
          requiereLote: s.requiereLote,
        }))}
        edicion={{ id: devolucion.id, valoresIniciales }}
      />
    </div>
  );
}
