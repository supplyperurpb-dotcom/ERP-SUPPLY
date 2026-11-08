import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoIQFForm } from "./ingreso-iqf-form";

export default async function NuevoIngresoIQFPage() {
  const [tiposBandejaDb, tiposPalletDb, palletsAbiertosDb, camionesDb, conductoresDb] = await Promise.all([
    prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.tipoPallet.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.palletIQF.findMany({
      where: { estado: "ABIERTO", origen: "DESCARTE_PLANTA" },
      orderBy: { numero: "asc" },
    }),
    prisma.camion.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
    prisma.conductor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  // Se mapea explícitamente a objetos planos: el campo Decimal de Prisma no
  // se puede pasar tal cual a un Client Component (ver lib/utils.ts).
  const tiposBandeja = tiposBandejaDb.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    pesoTaraKg: t.pesoTaraKg.toString(),
  }));
  const tiposPallet = tiposPalletDb.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    pesoTaraKg: t.pesoTaraKg.toString(),
  }));
  const palletsAbiertos = palletsAbiertosDb.map((p) => ({ id: p.id, numero: p.numero, cantidadBandejas: p.cantidadBandejas }));
  const camiones = camionesDb.map((c) => ({ id: c.id, placa: c.placa, tipo: c.tipo }));
  const conductores = conductoresDb.map((c) => ({ id: c.id, nombre: c.nombre }));

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso IQF"
        descripcion="Registra el descarte de planta: se ingresa una sola vez por camión (placa, hora de recepción) y puede tener varias líneas de pesaje por variedad, asignadas a un pallet físico propio de IQF (nuevo o existente, máximo 256 bandejas)."
      />
      <IngresoIQFForm
        tiposBandeja={tiposBandeja}
        tiposPallet={tiposPallet}
        palletsAbiertos={palletsAbiertos}
        camiones={camiones}
        conductores={conductores}
      />
    </div>
  );
}
