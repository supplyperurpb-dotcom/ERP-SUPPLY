import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoIQFForm } from "../../nuevo/ingreso-iqf-form";
import type { IngresoIQFInput } from "@/lib/validations/ingreso-iqf";

export default async function EditarIngresoIQFPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [ingreso, proveedoresDb, tiposBandejaDb, tiposPalletDb, palletsAbiertosDb] = await Promise.all([
    prisma.ingresoIQF.findUnique({ where: { id }, include: { pallets: true } }),
    prisma.proveedor.findMany({
      where: { activo: true, tipo: { in: ["FUNDO", "AMBOS"] } },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.tipoPallet.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.palletIQF.findMany({
      where: { estado: "ABIERTO", origen: "DESCARTE_PLANTA" },
      orderBy: { numero: "asc" },
    }),
  ]);

  if (!ingreso) {
    notFound();
  }

  // Los pallets que este ingreso ya usa se incluyen aunque estén CERRADOS
  // (p. ej. por este mismo ingreso), para que sigan apareciendo en el
  // formulario con su número — si no, "Pallet asignado" no podría mostrar
  // su etiqueta.
  const idsPalletsPropios = Array.from(new Set(ingreso.pallets.map((l) => l.palletId)));
  const palletsPropiosDb = idsPalletsPropios.length
    ? await prisma.palletIQF.findMany({ where: { id: { in: idsPalletsPropios } } })
    : [];

  const proveedores = proveedoresDb.map((p) => ({ id: p.id, razonSocial: p.razonSocial }));
  const tiposBandeja = tiposBandejaDb.map((t) => ({ id: t.id, nombre: t.nombre, pesoTaraKg: t.pesoTaraKg.toString() }));
  const tiposPallet = tiposPalletDb.map((t) => ({ id: t.id, nombre: t.nombre, pesoTaraKg: t.pesoTaraKg.toString() }));

  const palletsPorId = new Map(
    [...palletsAbiertosDb, ...palletsPropiosDb].map((p) => [p.id, p])
  );
  const palletsAbiertos = Array.from(palletsPorId.values()).map((p) => ({
    id: p.id,
    numero: p.numero,
    cantidadBandejas: p.cantidadBandejas,
  }));

  const contribucionOriginalPorPallet: Record<string, number> = {};
  for (const linea of ingreso.pallets) {
    contribucionOriginalPorPallet[linea.palletId] =
      (contribucionOriginalPorPallet[linea.palletId] ?? 0) + linea.cantidadBandejas;
  }

  const valoresIniciales: IngresoIQFInput = {
    proveedorId: ingreso.proveedorId,
    // Igual que al crear: string "YYYY-MM-DD", no objeto Date (zod lo
    // convierte recién al validar).
    fechaCosecha: ingreso.fechaCosecha.toISOString().slice(0, 10) as unknown as Date,
    horaIngreso: ingreso.horaIngreso ?? "",
    placaTransporte: ingreso.placaTransporte ?? "",
    observaciones: ingreso.observaciones ?? "",
    pallets: ingreso.pallets.map((linea) => ({
      variedad: linea.variedad,
      tipoBandejaId: linea.tipoBandejaId,
      tipoPalletId: linea.tipoPalletId ?? "",
      cantidadBandejas: linea.cantidadBandejas,
      pesoBrutoTotalKg: Number(linea.pesoBrutoTotalKg),
      palletAsignado: `existente:${linea.palletId}`,
    })),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar ingreso ${ingreso.numero}`}
        descripcion="Modifica los datos del camión y sus líneas de pesaje. Los totales de los pallets IQF afectados se recalculan automáticamente al guardar."
      />
      <IngresoIQFForm
        proveedores={proveedores}
        tiposBandeja={tiposBandeja}
        tiposPallet={tiposPallet}
        palletsAbiertos={palletsAbiertos}
        edicion={{ ingresoId: ingreso.id, valoresIniciales, contribucionOriginalPorPallet }}
      />
    </div>
  );
}
