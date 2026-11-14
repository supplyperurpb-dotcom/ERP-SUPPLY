import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { variedadDePalletIndustrial, descripcionPackingList } from "@/lib/acopio";
import { PackingListIndustrialAcopioView } from "./packing-list-industrial-acopio-view";

export default async function DespachoIndustrialDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const despacho = await prisma.despachoIndustrial.findUnique({
    where: { id },
    include: {
      tarjas: { include: { pallet: { include: { lineas: true, lineasFruta: true } } }, orderBy: { numero: "asc" } },
    },
  });
  if (!despacho) notFound();

  const registradoPor = despacho.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: despacho.creadoPorId }, select: { nombres: true, apellidos: true } })
    : null;

  const totalBandejas = despacho.tarjas.reduce((acc, t) => acc + t.pallet.cantidadBandejas, 0);
  const pesoNetoTotalKg = despacho.tarjas.reduce((acc, t) => acc + Number(t.pallet.pesoNetoKg), 0);

  return (
    <div>
      <PageHeader
        titulo={`Packing List Industrial Acopio ${despacho.numero}`}
        descripcion={`Resumen del despacho Industrial · ${formatDate(despacho.fechaDespacho)}${despacho.horaDespacho ? ` ${despacho.horaDespacho}` : ""}`}
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
          registradoPor: registradoPor ? `${registradoPor.nombres} ${registradoPor.apellidos}` : "—",
        }}
        tarjas={despacho.tarjas.map((t) => ({
          id: t.id,
          descripcion: descripcionPackingList(t.pallet.cantidadBandejas, variedadDePalletIndustrial(t.pallet), t.numero),
          pesoNetoKg: Number(t.pallet.pesoNetoKg),
        }))}
        totalBandejas={totalBandejas}
        pesoNetoTotalKg={pesoNetoTotalKg}
      />
    </div>
  );
}
