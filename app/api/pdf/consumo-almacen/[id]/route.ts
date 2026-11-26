import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { descargarArchivo } from "@/lib/storage";
import { generarConsumoAlmacenPdf } from "@/lib/pdf/consumo-almacen-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consumo = await prisma.consumoAlmacen.findUnique({
    where: { id },
    include: { items: { include: { sku: true } } },
  });

  if (!consumo) {
    return NextResponse.json({ error: "No se encontró el consumo." }, { status: 404 });
  }

  const registrador = consumo.creadoPorId
    ? await prisma.usuario.findUnique({ where: { id: consumo.creadoPorId } })
    : null;

  const firmaPngBytes = consumo.firmaArchivo ? await descargarArchivo(consumo.firmaArchivo) : null;
  // Si el archivo ya no existe en el storage (caso excepcional), el PDF se
  // sigue generando sin la segunda hoja en vez de romperse entero.
  const fotoEvidenciaBytes = consumo.fotoEvidenciaArchivo
    ? await descargarArchivo(consumo.fotoEvidenciaArchivo).catch(() => null)
    : null;

  const bytes = await generarConsumoAlmacenPdf({
    numero: consumo.numero,
    fecha: consumo.fecha,
    horaRetiro: consumo.horaRetiro,
    retiradoPorNombre: consumo.retiradoPor ?? "—",
    retiradoPorDni: consumo.retiradoPorDni,
    registradoPor: registrador ? `${registrador.nombres} ${registrador.apellidos}` : "—",
    vehiculoPlaca: consumo.vehiculoPlaca,
    horometroKilometraje: consumo.horometroKilometraje ? Number(consumo.horometroKilometraje) : null,
    observaciones: consumo.observaciones,
    lineas: consumo.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      lote: item.lote,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
    })),
    firmaPngBytes,
    fotoEvidenciaBytes,
    fotoEvidenciaRuta: consumo.fotoEvidenciaArchivo,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${consumo.numero}.pdf"`,
    },
  });
}
