import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { descargarArchivo } from "@/lib/storage";
import { generarConsumoAlmacenPdf } from "@/lib/pdf/consumo-almacen-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consumo = await prisma.consumoAlmacen.findUnique({
    where: { id },
    include: { almacen: true, items: { include: { sku: true } } },
  });

  if (!consumo) {
    return NextResponse.json({ error: "No se encontró el consumo." }, { status: 404 });
  }

  const registrador = consumo.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: consumo.creadoPorId } })
    : null;

  const firmaPngBytes = consumo.firmaArchivo ? await descargarArchivo(consumo.firmaArchivo) : null;

  const bytes = await generarConsumoAlmacenPdf({
    numero: consumo.numero,
    almacen: consumo.almacen.nombre,
    fecha: consumo.fecha,
    horaRetiro: consumo.horaRetiro,
    retiradoPor: consumo.retiradoPor ? `${consumo.retiradoPor} (DNI ${consumo.retiradoPorDni ?? "—"})` : "—",
    registradoPor: registrador ? `${registrador.nombres} ${registrador.apellidos}` : "—",
    observaciones: consumo.observaciones,
    lineas: consumo.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.lote ? `${item.sku.descripcion} (Lote ${item.lote})` : item.sku.descripcion,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
    })),
    firmaPngBytes,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${consumo.numero}.pdf"`,
    },
  });
}
