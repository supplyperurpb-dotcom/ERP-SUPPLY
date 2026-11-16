import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sustento = await prisma.sustentoRegistroAvance.findUnique({ where: { id }, select: { archivo: true } });
  if (!sustento) {
    return NextResponse.json({ error: "Este sustento ya no existe." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(sustento.archivo);
  return NextResponse.redirect(url);
}
