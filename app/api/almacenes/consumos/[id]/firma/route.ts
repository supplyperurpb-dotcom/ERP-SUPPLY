import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consumo = await prisma.consumoAlmacen.findUnique({
    where: { id },
    select: { firmaArchivo: true },
  });
  if (!consumo) {
    return NextResponse.json({ error: "El consumo no existe." }, { status: 404 });
  }
  if (!consumo.firmaArchivo) {
    return NextResponse.json({ error: "Este consumo no tiene firma adjunta." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(consumo.firmaArchivo);
  return NextResponse.redirect(url);
}
