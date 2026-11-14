import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoIndustrialForm } from "../../nuevo/ingreso-industrial-form";
import type { IngresoIndustrialInput } from "@/lib/validations/ingreso-industrial";

export default async function EditarIngresoIndustrialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [ingreso, tiposBandejaDb, tiposPalletDb, palletsAbiertosDb, camionesDb, conductoresDb] = await Promise.all([
    prisma.ingresoIndustrial.findUnique({ where: { id }, include: { pallets: true } }),
    prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.tipoPallet.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.palletIndustrial.findMany({
      where: { estado: "ABIERTO", origen: "DESCARTE_PLANTA" },
      orderBy: { numero: "asc" },
    }),
    prisma.camion.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
    // En Ingreso Industrial solo se elige entre conductores de Terceros
    // (ver Conductor.tipo) — los Propios son para materia prima.
    prisma.conductor.findMany({ where: { activo: true, tipo: "TERCERO" }, orderBy: { nombre: "asc" } }),
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
    ? await prisma.palletIndustrial.findMany({ where: { id: { in: idsPalletsPropios } } })
    : [];

  const tiposBandeja = tiposBandejaDb.map((t) => ({ id: t.id, nombre: t.nombre, pesoTaraKg: t.pesoTaraKg.toString() }));
  const tiposPallet = tiposPalletDb.map((t) => ({ id: t.id, nombre: t.nombre, pesoTaraKg: t.pesoTaraKg.toString() }));
  const camiones = camionesDb.map((c) => ({ id: c.id, placa: c.placa, tipo: c.tipo }));
  const conductores = conductoresDb.map((c) => ({ id: c.id, nombre: c.nombre }));

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

  const valoresIniciales: IngresoIndustrialInput = {
    horaIngreso: ingreso.horaIngreso ?? "",
    placaTransporte: ingreso.placaTransporte ?? "",
    conductor: ingreso.conductor ?? "",
    numeroGuiaRemision: ingreso.numeroGuiaRemision ?? "",
    guiaRemisionArchivo: ingreso.guiaRemisionArchivo ?? "",
    observaciones: ingreso.observaciones ?? "",
    pallets: ingreso.pallets.map((linea) => ({
      variedad: linea.variedad,
      // Igual que al crear: string "YYYY-MM-DD", no objeto Date (zod lo
      // convierte recién al validar).
      fechaCosecha: linea.fechaCosecha.toISOString().slice(0, 10) as unknown as Date,
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
        descripcion="Modifica los datos del camión y sus líneas de pesaje. Los totales de los pallets Industrial afectados se recalculan automáticamente al guardar."
      />
      <IngresoIndustrialForm
        tiposBandeja={tiposBandeja}
        tiposPallet={tiposPallet}
        palletsAbiertos={palletsAbiertos}
        camiones={camiones}
        conductores={conductores}
        edicion={{
          ingresoId: ingreso.id,
          valoresIniciales,
          contribucionOriginalPorPallet,
          fechaRegistro: ingreso.fechaIngreso.toISOString().slice(0, 10),
        }}
      />
    </div>
  );
}
