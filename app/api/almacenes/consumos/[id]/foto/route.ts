import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consumo = await prisma.consumoAlmacen.findUnique({
    where: { id },
    select: { fotoEvidenciaArchivo: true },
  });
  if (!consumo) {
    return NextResponse.json({ error: "El consumo no existe." }, { status: 404 });
  }
  if (!consumo.fotoEvidenciaArchivo) {
    return NextResponse.json({ error: "Este consumo no tiene foto de evidencia adjunta." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(consumo.fotoEvidenciaArchivo);
  return NextResponse.redirect(url);
}
