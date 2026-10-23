import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { generarSolicitudDespachoPdf } from "@/lib/pdf/solicitud-despacho-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const solicitud = await prisma.solicitudDespacho.findUnique({
    where: { id },
    include: { items: { include: { sku: true } } },
  });

  if (!solicitud) {
    return NextResponse.json({ error: "No se encontró la solicitud de despacho." }, { status: 404 });
  }

  const solicitante = solicitud.solicitanteId
    ? await prisma.usuario.findUnique({ where: { id: solicitud.solicitanteId } })
    : null;

  const bytes = await generarSolicitudDespachoPdf({
    numero: solicitud.numero,
    area: AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area,
    fecha: solicitud.fecha,
    solicitante: solicitante ? `${solicitante.nombres} ${solicitante.apellidos}` : "—",
    observaciones: solicitud.observaciones,
    lineas: solicitud.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
      centroCosto: item.centroCosto,
      campo: item.campo,
    })),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${solicitud.numero}.pdf"`,
    },
  });
}
