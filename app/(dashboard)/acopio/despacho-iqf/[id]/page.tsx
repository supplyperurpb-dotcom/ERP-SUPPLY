import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { PackingListIndustrialAcopioView } from "./packing-list-industrial-acopio-view";

export default async function DespachoIQFDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const despacho = await prisma.despachoIQF.findUnique({
    where: { id },
    include: { tarjas: { include: { pallet: true }, orderBy: { numero: "asc" } } },
  });
  if (!despacho) notFound();

  const totalBandejas = despacho.tarjas.reduce((acc, t) => acc + t.pallet.cantidadBandejas, 0);
  const pesoNetoTotalKg = despacho.tarjas.reduce((acc, t) => acc + Number(t.pallet.pesoNetoKg), 0);

  return (
    <div>
      <PageHeader
        titulo={`Packing List Industrial Acopio ${despacho.numero}`}
        descripcion={`Resumen del despacho IQF · ${formatDate(despacho.fechaDespacho)}${despacho.horaDespacho ? ` ${despacho.horaDespacho}` : ""}`}
      />
      <PackingListIndustrialAcopioView
        despacho={{
          id: despacho.id,
          numero: despacho.numero,
          placaCamion: despacho.placaCamion,
          conductor: despacho.conductor,
          estado: despacho.estado,
          numeroGuiaRemision: despacho.numeroGuiaRemision,
          guiaRemisionArchivo: despacho.guiaRemisionArchivo,
        }}
        tarjas={despacho.tarjas.map((t) => ({
          id: t.id,
          numero: t.numero,
          palletNumero: t.pallet.numero,
          cantidadBandejas: t.pallet.cantidadBandejas,
          pesoNetoKg: Number(t.pallet.pesoNetoKg),
        }))}
        totalBandejas={totalBandejas}
        pesoNetoTotalKg={pesoNetoTotalKg}
      />
    </div>
  );
}
