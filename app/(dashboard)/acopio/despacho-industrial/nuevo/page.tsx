import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { DespachoIndustrialForm } from "./despacho-industrial-form";

export default async function NuevoDespachoIndustrialPage() {
  const [tarjasDb, camionesDb, conductoresDb] = await Promise.all([
    // Solo pallets CERRADOS pueden salir en un despacho (ver mismo
    // criterio en acopio/despacho/nuevo/page.tsx).
    prisma.tarjaIndustrial.findMany({
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
        titulo="Nuevo despacho Industrial"
        descripcion="Selecciona las tarjas (pallets Industrial) que salen en este despacho. Una vez despachadas, ya no aparecerán disponibles para un despacho futuro."
      />
      <DespachoIndustrialForm tarjasDisponibles={tarjasDisponibles} camiones={camiones} conductores={conductores} />
    </div>
  );
}
