import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DespachoIQFForm } from "./despacho-iqf-form";

export default async function NuevoDespachoIQFPage() {
  const tarjasDb = await prisma.tarjaIQF.findMany({
    where: { despachoId: null },
    include: { pallet: true },
    orderBy: { numero: "asc" },
  });

  // Se mapea a un objeto plano: pesoNetoKg es Decimal y no se puede pasar
  // tal cual a un Client Component (ver lib/utils.ts).
  const tarjasDisponibles = tarjasDb.map((t) => ({
    id: t.id,
    numero: t.numero,
    palletNumero: t.pallet.numero,
    cantidadBandejas: t.pallet.cantidadBandejas,
    pesoNetoKg: Number(t.pallet.pesoNetoKg),
  }));

  return (
    <div>
      <PageHeader
        titulo="Nuevo despacho IQF"
        descripcion="Selecciona las tarjas (pallets IQF) que salen en este despacho. Una vez despachadas, ya no aparecerán disponibles para un despacho futuro."
      />
      <DespachoIQFForm tarjasDisponibles={tarjasDisponibles} />
    </div>
  );
}
