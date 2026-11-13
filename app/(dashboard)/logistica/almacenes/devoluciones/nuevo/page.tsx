import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { siguienteNumero } from "@/lib/utils";
import { DevolucionAlmacenForm } from "./devolucion-almacen-form";

export default async function NuevaDevolucionAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ almacenId?: string }>;
}) {
  const { almacenId } = await searchParams;

  const [usuario, almacenes, proveedores, retiradores, skus, existentes] = await Promise.all([
    getUsuarioActual(),
    prisma.almacen.findMany({ where: { activo: true, esGeneral: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    prisma.retiradorAutorizado.findMany({
      where: { activo: true },
      include: { almacenesPermitidos: true },
      orderBy: { apellidos: "asc" },
    }),
    prisma.sku.findMany({ where: { activo: true }, orderBy: { codigo: "asc" } }),
    prisma.devolucionAlmacen.findMany({ select: { numero: true } }),
  ]);
  if (!usuario) redirect("/login");

  // Solo un adelanto: el número real se asigna recién al guardar (ver
  // crearDevolucionAlmacenAction), por si dos personas registran una
  // devolución al mismo tiempo.
  const numeroTentativo = siguienteNumero(existentes.map((d) => d.numero), "DA-");

  return (
    <div>
      <PageHeader
        titulo={`Nueva devolución de almacén — ${numeroTentativo}`}
        descripcion="Registra material que un área había retirado y no usó, de vuelta al almacén. No depende de una Orden de Compra."
      />
      <DevolucionAlmacenForm
        usuario={{ nombres: usuario.nombres, apellidos: usuario.apellidos }}
        almacenes={almacenes.map((a) => ({ id: a.id, codigo: a.codigo, nombre: a.nombre, categoriaGeneral: a.categoriaGeneral }))}
        proveedores={proveedores.map((p) => ({ id: p.id, razonSocial: p.razonSocial, ruc: p.numeroDocumento }))}
        retiradores={retiradores.map((r) => ({
          id: r.id,
          nombreCompleto: `${r.nombres} ${r.apellidos}`,
          dni: r.dni,
          area: r.area,
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
        almacenIdInicial={almacenId}
      />
    </div>
  );
}
