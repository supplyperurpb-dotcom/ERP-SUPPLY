import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarTarjaPdf } from "@/lib/pdf/tarja-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ palletId: string }> }) {
  const { palletId } = await params;
  const pallet = await prisma.pallet.findUnique({
    where: { id: palletId },
    include: {
      tarja: true,
      lineas: {
        include: { tipoBandeja: true, ingresoFruta: { include: { proveedor: true } } },
        orderBy: { numeroPallet: "asc" },
      },
    },
  });

  if (!pallet || !pallet.tarja) {
    return NextResponse.json({ error: "No se encontró la tarja de este pallet." }, { status: 404 });
  }

  const proveedores = Array.from(new Set(pallet.lineas.map((l) => l.ingresoFruta.proveedor.razonSocial)));

  const bytes = await generarTarjaPdf({
    tarjaNumero: pallet.tarja.numero,
    palletNumero: pallet.numero,
    fechaEmision: pallet.tarja.fechaEmision,
    proveedor: proveedores.join(", ") || "—",
    lineas: pallet.lineas.map((l) => ({
      modulo: l.modulo,
      turno: l.turno,
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
