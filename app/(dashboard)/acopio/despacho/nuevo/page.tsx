import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DespachoForm } from "./despacho-form";

export default async function NuevoDespachoPage() {
  const [tarjasDb, vehiculosDb] = await Promise.all([
    prisma.tarja.findMany({
      where: { despachoId: null },
      include: { pallet: true },
      orderBy: { numero: "asc" },
    }),
    prisma.vehiculoTransporte.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
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
  const vehiculos = vehiculosDb.map((v) => ({ id: v.id, placa: v.placa, tipo: v.tipo }));

  return (
    <div>
      <PageHeader
        titulo="Nuevo despacho"
        descripcion="Selecciona las tarjas (pallets) que salen en este despacho. Una vez despachadas, ya no aparecerán disponibles para un despacho futuro."
      />
      <DespachoForm tarjasDisponibles={tarjasDisponibles} vehiculos={vehiculos} />
    </div>
  );
}
