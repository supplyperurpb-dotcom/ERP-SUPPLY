import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoIQFForm } from "./ingreso-iqf-form";

export default async function NuevoIngresoIQFPage() {
  const [proveedoresDb, tiposBandejaDb, tiposPalletDb, palletsAbiertosDb] = await Promise.all([
    prisma.proveedor.findMany({
      where: { activo: true, tipo: { in: ["FUNDO", "AMBOS"] } },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.tipoPallet.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.palletIQF.findMany({ where: { estado: "ABIERTO" }, orderBy: { numero: "asc" } }),
  ]);

  // Se mapea explícitamente a objetos planos: el campo Decimal de Prisma no
  // se puede pasar tal cual a un Client Component (ver lib/utils.ts).
  const proveedores = proveedoresDb.map((p) => ({ id: p.id, razonSocial: p.razonSocial }));
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

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso IQF"
        descripcion="Registra el descarte de planta: se ingresa una sola vez por camión (placa, hora de recepción) y puede tener varias líneas de pesaje por variedad, asignadas a un pallet físico propio de IQF (nuevo o existente, máximo 240 bandejas). Se valida que la variedad ingresada sí se haya recibido en Ingreso de Materia Prima en la fecha de cosecha indicada."
      />
      <IngresoIQFForm
        proveedores={proveedores}
        tiposBandeja={tiposBandeja}
        tiposPallet={tiposPallet}
        palletsAbiertos={palletsAbiertos}
      />
    </div>
  );
}
