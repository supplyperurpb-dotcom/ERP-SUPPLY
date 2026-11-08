import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { IngresoFrutaForm } from "../../nuevo/ingreso-fruta-form";
import type { IngresoFrutaInput } from "@/lib/validations/ingreso-fruta";

export default async function EditarIngresoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [ingreso, proveedoresDb, tiposBandejaDb, tiposPalletDb, palletsAbiertosDb, palletsAbiertosIndustrialDb, camionesDb, conductoresDb] =
    await Promise.all([
      prisma.ingresoFruta.findUnique({ where: { id }, include: { pallets: true } }),
      prisma.proveedor.findMany({
        where: { activo: true, tipo: { in: ["FUNDO", "AMBOS"] } },
        orderBy: { razonSocial: "asc" },
      }),
      prisma.tipoBandeja.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
      prisma.tipoPallet.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
      prisma.pallet.findMany({ where: { estado: "ABIERTO" }, orderBy: { numero: "asc" } }),
      prisma.palletIndustrial.findMany({
        where: { estado: "ABIERTO", origen: "DESCARTE_CAMPO" },
        orderBy: { numero: "asc" },
      }),
      prisma.camion.findMany({ where: { activo: true }, orderBy: { placa: "asc" } }),
      prisma.conductor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    ]);

  if (!ingreso) {
    notFound();
  }

  // Los pallets que este ingreso ya usa se incluyen aunque estén CERRADOS
  // (p. ej. por este mismo ingreso), para que sigan apareciendo en el
  // formulario con su número — si no, "Pallet asignado" no podría mostrar
  // su etiqueta. Cada línea vieja usó un Pallet normal (Exportable) o un
  // PalletIndustrial (Descarte Campo), nunca ambos.
  const idsPalletsPropios = Array.from(
    new Set(ingreso.pallets.map((l) => l.palletId).filter((v): v is string => !!v))
  );
  const idsPalletsPropiosIndustrial = Array.from(
    new Set(ingreso.pallets.map((l) => l.palletIndustrialId).filter((v): v is string => !!v))
  );
  const [palletsPropiosDb, palletsPropiosIndustrialDb] = await Promise.all([
    idsPalletsPropios.length ? prisma.pallet.findMany({ where: { id: { in: idsPalletsPropios } } }) : [],
    idsPalletsPropiosIndustrial.length ? prisma.palletIndustrial.findMany({ where: { id: { in: idsPalletsPropiosIndustrial } } }) : [],
  ]);

  const proveedores = proveedoresDb.map((p) => ({ id: p.id, razonSocial: p.razonSocial }));
  const tiposBandeja = tiposBandejaDb.map((t) => ({ id: t.id, nombre: t.nombre, pesoTaraKg: t.pesoTaraKg.toString() }));
  const tiposPallet = tiposPalletDb.map((t) => ({ id: t.id, nombre: t.nombre, pesoTaraKg: t.pesoTaraKg.toString() }));
  const camiones = camionesDb.map((c) => ({ id: c.id, placa: c.placa, tipo: c.tipo }));
  const conductores = conductoresDb.map((c) => ({ id: c.id, nombre: c.nombre }));

  const palletsPorId = new Map([...palletsAbiertosDb, ...palletsPropiosDb].map((p) => [p.id, p]));
  const palletsAbiertos = Array.from(palletsPorId.values()).map((p) => ({
    id: p.id,
    numero: p.numero,
    cantidadBandejas: p.cantidadBandejas,
  }));

  const palletsIndustrialPorId = new Map([...palletsAbiertosIndustrialDb, ...palletsPropiosIndustrialDb].map((p) => [p.id, p]));
  const palletsAbiertosIndustrial = Array.from(palletsIndustrialPorId.values()).map((p) => ({
    id: p.id,
    numero: p.numero,
    cantidadBandejas: p.cantidadBandejas,
  }));

  const contribucionOriginalPorPallet: Record<string, number> = {};
  for (const linea of ingreso.pallets) {
    const palletId = linea.palletId ?? linea.palletIndustrialId;
    if (!palletId) continue;
    contribucionOriginalPorPallet[palletId] = (contribucionOriginalPorPallet[palletId] ?? 0) + linea.cantidadBandejas;
  }

  const valoresIniciales: IngresoFrutaInput = {
    proveedorId: ingreso.proveedorId,
    // Igual que al crear: string "YYYY-MM-DD", no objeto Date (zod lo
    // convierte recién al validar). toISOString() aquí es seguro porque la
    // fecha se guardó a partir de ese mismo formato (medianoche UTC).
    fechaCosecha: ingreso.fechaCosecha.toISOString().slice(0, 10) as unknown as Date,
    horaIngreso: ingreso.horaIngreso ?? "",
    placaTransporte: ingreso.placaTransporte ?? "",
    conductor: ingreso.conductor ?? "",
    observaciones: ingreso.observaciones ?? "",
    pallets: ingreso.pallets.map((linea) => ({
      modulo: linea.modulo,
      turno: linea.turno,
      variedad: linea.variedad,
      formato: linea.formato,
      tipoProducto: linea.tipoProducto,
      tipoBandejaId: linea.tipoBandejaId,
      tipoPalletId: linea.tipoPalletId ?? "",
      cantidadBandejas: linea.cantidadBandejas,
      pesoBrutoTotalKg: Number(linea.pesoBrutoTotalKg),
      palletAsignado: `existente:${linea.palletId ?? linea.palletIndustrialId}`,
    })),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar ingreso ${ingreso.numero}`}
        descripcion="Modifica los datos del camión y sus líneas de pesaje. Los totales de los pallets afectados se recalculan automáticamente al guardar."
      />
      <IngresoFrutaForm
        proveedores={proveedores}
        tiposBandeja={tiposBandeja}
        tiposPallet={tiposPallet}
        palletsAbiertos={palletsAbiertos}
        palletsAbiertosIndustrial={palletsAbiertosIndustrial}
        camiones={camiones}
        conductores={conductores}
        edicion={{ ingresoId: ingreso.id, valoresIniciales, contribucionOriginalPorPallet }}
      />
    </div>
  );
}
