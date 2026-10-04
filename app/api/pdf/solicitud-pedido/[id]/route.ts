import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, NOMBRE_SOLICITUD, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { generarSolicitudPedidoPdf } from "@/lib/pdf/solicitud-pedido-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const solicitud = await prisma.solicitudPedido.findUnique({
    where: { id },
    include: { items: { include: { sku: true } } },
  });

  if (!solicitud) {
    return NextResponse.json({ error: "No se encontró la solicitud de pedido." }, { status: 404 });
  }

  const [solicitante, aprobador] = await Promise.all([
    solicitud.solicitanteId ? prisma.usuario.findUnique({ where: { id: solicitud.solicitanteId } }) : null,
    solicitud.aprobadoPorId ? prisma.usuario.findUnique({ where: { id: solicitud.aprobadoPorId } }) : null,
  ]);

  const bytes = await generarSolicitudPedidoPdf({
    nombreDocumento: NOMBRE_SOLICITUD[solicitud.categoria as CategoriaCompraCodigo],
    numero: solicitud.numero,
    area: AREAS_EMPRESA.find((a) => a.valor === solicitud.area)?.nombre ?? solicitud.area,
    fecha: solicitud.fecha,
    fechaNecesidad: solicitud.fechaNecesidad,
    tipoNecesidad: TIPOS_NECESIDAD.find((t) => t.valor === solicitud.tipoNecesidad)?.nombre ?? solicitud.tipoNecesidad,
    solicitante: solicitante ? `${solicitante.nombres} ${solicitante.apellidos}` : "—",
    justificacion: solicitud.justificacion,
    lineas: solicitud.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.descripcion ? `${item.sku.descripcion} — ${item.descripcion}` : item.sku.descripcion,
      cantidad: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
      centroCosto: AREAS_EMPRESA.find((a) => a.valor === item.centroCosto)?.nombre ?? item.centroCosto,
      observaciones: item.observaciones,
      campo: item.campo,
    })),
    aprobado: solicitud.estado === "APROBADO",
    aprobadoPor: aprobador ? { nombre: `${aprobador.nombres} ${aprobador.apellidos}`, cargo: aprobador.cargo } : null,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${solicitud.numero}.pdf"`,
    },
  });
}
