import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

// Descarga UN sustento de los varios que puede tener una OC/OS (ver
// OrdenCompraSustento) — distinto de /api/logistica/ordenes-compra/[id]/
// sustento, que sigue sirviendo el archivo único de las órdenes creadas
// antes de admitir varios.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sustento = await prisma.ordenCompraSustento.findUnique({ where: { id }, select: { archivo: true } });
  if (!sustento) {
    return NextResponse.json({ error: "Este sustento ya no existe." }, { status: 404 });
  }

  const url = await obtenerUrlFirmadaArchivo(sustento.archivo);
  return NextResponse.redirect(url);
}
