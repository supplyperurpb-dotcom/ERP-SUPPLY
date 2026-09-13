import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoFrutaForm } from "./ingreso-fruta-form";

export default async function NuevoIngresoPage() {
  const [proveedoresDb, tiposBandejaDb, tiposPalletDb, palletsAbiertosDb, palletsAbiertosIQFDb] = await Promise.all([
    prisma.proveedor.findMany({
      where: { activo: true, tipo: { in: ["FUNDO", "AMBOS"] } },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.tipoPallet.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.pallet.findMany({ where: { estado: "ABIERTO" }, orderBy: { numero: "asc" } }),
    prisma.palletIQF.findMany({
      where: { estado: "ABIERTO", origen: "DESCARTE_CAMPO" },
      orderBy: { numero: "asc" },
    }),
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
  // cantidadBandejas es Int (no Decimal), así que no necesita conversión.
  const palletsAbiertos = palletsAbiertosDb.map((p) => ({ id: p.id, numero: p.numero, cantidadBandejas: p.cantidadBandejas }));
  const palletsAbiertosIQF = palletsAbiertosIQFDb.map((p) => ({ id: p.id, numero: p.numero, cantidadBandejas: p.cantidadBandejas }));

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso de materia prima"
        descripcion="Registra la llegada de un camión a planta: se ingresa una sola vez (placa, hora de recepción) y puede tener varias líneas de pesaje, cada una con su propio módulo, turno y variedad, asignada a un pallet físico (nuevo o existente, máximo 240 bandejas). Las líneas de Descarte Campo arman pallets IQF en vez de pallets normales."
      />
      <IngresoFrutaForm
        proveedores={proveedores}
        tiposBandeja={tiposBandeja}
        tiposPallet={tiposPallet}
        palletsAbiertos={palletsAbiertos}
        palletsAbiertosIQF={palletsAbiertosIQF}
      />
    </div>
  );
}
