import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarTarjaIQFPdf } from "@/lib/pdf/tarja-iqf-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ palletId: string }> }) {
  const { palletId } = await params;
  const pallet = await prisma.palletIQF.findUnique({
    where: { id: palletId },
    include: {
      tarja: true,
      lineas: {
        include: { tipoBandeja: true, ingresoIQF: { include: { proveedor: true } } },
        orderBy: { numeroPallet: "asc" },
      },
    },
  });

  if (!pallet || !pallet.tarja) {
    return NextResponse.json({ error: "No se encontró la tarja de este pallet." }, { status: 404 });
  }

  const proveedores = Array.from(new Set(pallet.lineas.map((l) => l.ingresoIQF.proveedor.razonSocial)));

  const bytes = await generarTarjaIQFPdf({
    tarjaNumero: pallet.tarja.numero,
    palletNumero: pallet.numero,
    fechaEmision: pallet.tarja.fechaEmision,
    proveedor: proveedores.join(", ") || "—",
    lineas: pallet.lineas.map((l) => ({
      variedad: l.variedad,
      tipoBandeja: l.tipoBandeja.nombre,
      cantidadBandejas: l.cantidadBandejas,
      pesoNetoKg: Number(l.pesoNetoKg),
    })),
    totalBandejas: pallet.cantidadBandejas,
    pesoBrutoTotalKg: Number(pallet.pesoBrutoTotalKg),
    pesoTaraTotalKg: Number(pallet.pesoTaraTotalKg),
    pesoNetoTotalKg: Number(pallet.pesoNetoKg),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pallet.tarja.numero}.pdf"`,
    },
  });
}
