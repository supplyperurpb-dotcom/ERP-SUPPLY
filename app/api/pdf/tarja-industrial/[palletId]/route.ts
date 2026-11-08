import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarTarjaIndustrialPdf } from "@/lib/pdf/tarja-industrial-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ palletId: string }> }) {
  const { palletId } = await params;
  const pallet = await prisma.palletIndustrial.findUnique({
    where: { id: palletId },
    include: {
      tarja: true,
      lineas: {
        include: { tipoBandeja: true },
        orderBy: { numeroPallet: "asc" },
      },
      lineasFruta: {
        include: { tipoBandeja: true, ingresoFruta: { include: { proveedor: true } } },
        orderBy: { numeroPallet: "asc" },
      },
    },
  });

  if (!pallet || !pallet.tarja) {
    return NextResponse.json({ error: "No se encontró la tarja de este pallet." }, { status: 404 });
  }

  // El descarte de planta (pallet.lineas / IngresoIndustrial) ya no tiene fundo —
  // solo el descarte de campo (lineasFruta / IngresoFruta) puede aportar uno.
  const proveedores = Array.from(new Set(pallet.lineasFruta.map((l) => l.ingresoFruta.proveedor.razonSocial)));

  const bytes = await generarTarjaIndustrialPdf({
    tarjaNumero: pallet.tarja.numero,
    palletNumero: pallet.numero,
    fechaEmision: pallet.tarja.fechaEmision,
    proveedor: proveedores.join(", ") || "—",
    tipoProducto: pallet.origen === "DESCARTE_CAMPO" ? "Descarte Campo" : "Descarte Planta",
    lineas: [
      ...pallet.lineas.map((l) => ({
        variedad: l.variedad,
        tipoBandeja: l.tipoBandeja.nombre,
        cantidadBandejas: l.cantidadBandejas,
        pesoNetoKg: Number(l.pesoNetoKg),
      })),
      ...pallet.lineasFruta.map((l) => ({
        variedad: l.variedad,
        tipoBandeja: l.tipoBandeja.nombre,
        cantidadBandejas: l.cantidadBandejas,
        pesoNetoKg: Number(l.pesoNetoKg),
      })),
    ],
    totalBandejas: pallet.cantidadBandejas,
    pesoBrutoTotalKg: Number(pallet.pesoBrutoTotalKg),
    pesoTaraTotalKg: Number(pallet.pesoTaraTotalKg),
    pesoNetoTotalKg: Number(pallet.pesoNetoKg),
    palletAbierto: pallet.estado === "ABIERTO",
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pallet.tarja.numero}.pdf"`,
    },
  });
}
