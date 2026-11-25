import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenCompra.findUnique({ where: { id }, select: { archivo: true } });
  if (!orden?.archivo) {
    return NextResponse.json({ error: "Esta orden no tiene sustento adjunto." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(orden.archivo);
  return NextResponse.redirect(url);
}
