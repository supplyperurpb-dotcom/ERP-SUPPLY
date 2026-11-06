import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DespachoIQFForm } from "./despacho-iqf-form";

export default async function NuevoDespachoIQFPage() {
  const [tarjasDb, vehiculosDb] = await Promise.all([
    // Solo pallets CERRADOS pueden salir en un despacho (ver mismo
    // criterio en acopio/despacho/nuevo/page.tsx).
    prisma.tarjaIQF.findMany({
      where: { despachoId: null, pallet: { estado: "CERRADO" } },
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
        titulo="Nuevo despacho IQF"
        descripcion="Selecciona las tarjas (pallets IQF) que salen en este despacho. Una vez despachadas, ya no aparecerán disponibles para un despacho futuro."
      />
      <DespachoIQFForm tarjasDisponibles={tarjasDisponibles} vehiculos={vehiculos} />
    </div>
  );
}
