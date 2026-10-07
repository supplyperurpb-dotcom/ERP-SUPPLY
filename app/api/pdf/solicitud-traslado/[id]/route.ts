import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarSolicitudTrasladoPdf } from "@/lib/pdf/solicitud-traslado-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const solicitud = await prisma.solicitudTraslado.findUnique({
    where: { id },
    include: { almacenOrigen: true, almacenDestino: true, items: { include: { sku: true } } },
  });

  if (!solicitud) {
    return NextResponse.json({ error: "No se encontró la solicitud de traslado." }, { status: 404 });
  }

  const solicitante = solicitud.solicitanteId
    ? await prisma.usuario.findUnique({ where: { id: solicitud.solicitanteId } })
    : null;

  const bytes = await generarSolicitudTrasladoPdf({
    numero: solicitud.numero,
    almacenOrigen: solicitud.almacenOrigen.nombre,
    almacenDestino: solicitud.almacenDestino.nombre,
    fecha: solicitud.fecha,
    solicitante: solicitante ? `${solicitante.nombres} ${solicitante.apellidos}` : "—",
    observaciones: solicitud.observaciones,
    lineas: solicitud.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
    })),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${solicitud.numero}.pdf"`,
    },
  });
}
