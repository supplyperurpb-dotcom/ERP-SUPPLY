import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoFrutaForm } from "./ingreso-fruta-form";

export default async function NuevoIngresoPage() {
  const [proveedoresDb, tiposBandejaDb] = await Promise.all([
    prisma.proveedor.findMany({
      where: { activo: true, tipo: { in: ["FUNDO", "AMBOS"] } },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  // Se mapea explícitamente a objetos planos: el campo Decimal de Prisma no
  // se puede pasar tal cual a un Client Component (ver lib/utils.ts).
  const proveedores = proveedoresDb.map((p) => ({ id: p.id, razonSocial: p.razonSocial }));
  const tiposBandeja = tiposBandejaDb.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    pesoTaraKg: t.pesoTaraKg.toString(),
  }));

  return (
    <div>
      <PageHeader
        titulo="Nuevo ingreso de materia prima"
        descripcion="Registra la llegada de un camión a planta: se ingresa una sola vez (placa, hora de recepción) y puede tener varias líneas de pesaje, cada una con su propio módulo, turno y variedad. El peso neto de cada línea se calcula automáticamente (peso bruto − cantidad de bandejas × tara de la bandeja)."
      />
      <IngresoFrutaForm proveedores={proveedores} tiposBandeja={tiposBandeja} />
    </div>
  );
}
