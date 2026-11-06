import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const despacho = await prisma.despachoIQF.findUnique({
    where: { id },
    select: { guiaRemisionArchivo: true },
  });
  if (!despacho) {
    return NextResponse.json({ error: "El despacho no existe." }, { status: 404 });
  }
  if (!despacho.guiaRemisionArchivo) {
    return NextResponse.json({ error: "Este despacho no tiene guía de remisión adjunta." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(despacho.guiaRemisionArchivo);
  return NextResponse.redirect(url);
}
