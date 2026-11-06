import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarPackingListAcopioPdf } from "@/lib/pdf/packing-list-acopio-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const despacho = await prisma.despacho.findUnique({
    where: { id },
    include: { tarjas: { include: { pallet: true }, orderBy: { numero: "asc" } } },
  });

  if (!despacho) {
    return NextResponse.json({ error: "El despacho no existe." }, { status: 404 });
  }

  const totalBandejas = despacho.tarjas.reduce((acc, t) => acc + t.pallet.cantidadBandejas, 0);
  const pesoNetoTotalKg = despacho.tarjas.reduce((acc, t) => acc + Number(t.pallet.pesoNetoKg), 0);

  const bytes = await generarPackingListAcopioPdf({
    numero: despacho.numero,
    placaCamion: despacho.placaCamion,
    conductor: despacho.conductor,
    fechaDespacho: despacho.fechaDespacho,
    horaDespacho: despacho.horaDespacho,
    numeroGuiaRemision: despacho.numeroGuiaRemision,
    lineas: despacho.tarjas.map((t) => ({
      tarjaNumero: t.numero,
      palletNumero: t.pallet.numero,
      cantidadBandejas: t.pallet.cantidadBandejas,
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
