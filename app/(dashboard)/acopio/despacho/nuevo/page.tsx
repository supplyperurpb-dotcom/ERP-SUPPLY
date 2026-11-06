import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DespachoForm } from "./despacho-form";

export default async function NuevoDespachoPage() {
  const [tarjasDb, camionesDb, conductoresDb] = await Promise.all([
    prisma.tarja.findMany({
      where: { despachoId: null },
      include: { pallet: true },
      orderBy: { numero: "asc" },
    }),
    prisma.camion.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
    prisma.conductor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  // Se mapea a un objeto plano: pesoNetoKg es Decimal y no se puede pasar
  // tal cual a un Client Component (ver lib/utils.ts).
  const tarjasDisponibles = tarjasDb.map((t) => ({
    id: t.id,
    numero: t.numero,
    palletNumero: t.pallet.numero,
    cantidadBandejas: t.pallet.cantidadBandejas,
    pesoNetoKg: Number(t.pallet.pesoNetoKg),
  }));
  const camiones = camionesDb.map((c) => ({ id: c.id, placa: c.placa, tipo: c.tipo }));
  const conductores = conductoresDb.map((c) => ({ id: c.id, nombre: c.nombre }));

  return (
    <div>
      <PageHeader
        titulo="Nuevo despacho"
        descripcion="Selecciona las tarjas (pallets) que salen en este despacho. Al presionar Finalizar carga se genera el Packing List Acopio (código único), donde luego se adjunta la guía de remisión para culminar el proceso."
      />
      <DespachoForm tarjasDisponibles={tarjasDisponibles} camiones={camiones} conductores={conductores} />
    </div>
  );
}
