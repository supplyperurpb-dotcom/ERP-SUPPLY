import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ingreso = await prisma.ingresoAlmacen.findUnique({
    where: { id },
    select: { guiaRemisionArchivo: true },
  });
  if (!ingreso) {
    return NextResponse.json({ error: "El ingreso no existe." }, { status: 404 });
  }
  if (!ingreso.guiaRemisionArchivo) {
    return NextResponse.json({ error: "Este ingreso no tiene guía de remisión adjunta." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(ingreso.guiaRemisionArchivo);
  return NextResponse.redirect(url);
}
