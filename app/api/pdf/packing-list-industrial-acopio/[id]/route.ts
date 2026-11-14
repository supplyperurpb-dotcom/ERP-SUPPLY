import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarPackingListAcopioPdf } from "@/lib/pdf/packing-list-acopio-pdf";
import { variedadDePalletIndustrial, descripcionPackingList } from "@/lib/acopio";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const despacho = await prisma.despachoIndustrial.findUnique({
    where: { id },
    include: {
      tarjas: { include: { pallet: { include: { lineas: true, lineasFruta: true } } }, orderBy: { numero: "asc" } },
    },
  });

  if (!despacho) {
    return NextResponse.json({ error: "El despacho no existe." }, { status: 404 });
  }

  const registrador = despacho.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: despacho.creadoPorId }, select: { nombres: true, apellidos: true } })
    : null;

  const totalBandejas = despacho.tarjas.reduce((acc, t) => acc + t.pallet.cantidadBandejas, 0);
  const pesoNetoTotalKg = despacho.tarjas.reduce((acc, t) => acc + Number(t.pallet.pesoNetoKg), 0);

  const bytes = await generarPackingListAcopioPdf({
    titulo: "PACKING LIST INDUSTRIAL ACOPIO",
    numero: despacho.numero,
    placaCamion: despacho.placaCamion,
    conductor: despacho.conductor,
    fechaDespacho: despacho.fechaDespacho,
    horaDespacho: despacho.horaDespacho,
    numeroGuiaRemision: despacho.numeroGuiaRemision,
    registradoPor: registrador ? `${registrador.nombres} ${registrador.apellidos}` : "—",
    lineas: despacho.tarjas.map((t) => ({
      descripcion: descripcionPackingList(t.pallet.cantidadBandejas, variedadDePalletIndustrial(t.pallet), t.numero),
      pesoNetoKg: Number(t.pallet.pesoNetoKg),
    })),
    totalBandejas,
    pesoNetoTotalKg,
    borrador: despacho.estado === "BORRADOR",
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${despacho.numero}.pdf"`,
    },
  });
}
