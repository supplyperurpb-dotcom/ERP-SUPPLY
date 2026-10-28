import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const traslado = await prisma.trasladoAlmacen.findUnique({
    where: { id },
    select: { guiaRemisionArchivo: true },
  });
  if (!traslado) {
    return NextResponse.json({ error: "El traslado no existe." }, { status: 404 });
  }
  if (!traslado.guiaRemisionArchivo) {
    return NextResponse.json({ error: "Este traslado no tiene guía de remisión adjunta." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(traslado.guiaRemisionArchivo);
  return NextResponse.redirect(url);
}
