import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DespachoIQFForm } from "./despacho-iqf-form";

export default async function NuevoDespachoIQFPage() {
  const [tarjasDb, camionesDb, conductoresDb] = await Promise.all([
    // Solo pallets CERRADOS pueden salir en un despacho (ver mismo
    // criterio en acopio/despacho/nuevo/page.tsx).
    prisma.tarjaIQF.findMany({
      where: { despachoId: null, pallet: { estado: "CERRADO" } },
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
        titulo="Nuevo despacho IQF"
        descripcion="Selecciona las tarjas (pallets IQF) que salen en este despacho. Una vez despachadas, ya no aparecerán disponibles para un despacho futuro."
      />
      <DespachoIQFForm tarjasDisponibles={tarjasDisponibles} camiones={camiones} conductores={conductores} />
    </div>
  );
}
