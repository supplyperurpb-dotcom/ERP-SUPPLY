import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarActaTrasladoPdf } from "@/lib/pdf/traslado-almacen-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const traslado = await prisma.trasladoAlmacen.findUnique({
    where: { id },
    include: {
      almacenOrigen: true,
      almacenDestino: true,
      solicitudTraslado: true,
      items: { include: { sku: true, solicitudTrasladoItem: true } },
    },
  });

  if (!traslado) {
    return NextResponse.json({ error: "No se encontró el traslado." }, { status: 404 });
  }

  const bytes = await generarActaTrasladoPdf({
    numero: traslado.numero,
    solicitudNumero: traslado.solicitudTraslado?.numero ?? null,
    almacenOrigen: traslado.almacenOrigen.nombre,
    almacenDestino: traslado.almacenDestino.nombre,
    fecha: traslado.fecha,
    guiaRemision: traslado.guiaRemision,
    remitente: traslado.remitente,
    observaciones: traslado.observaciones,
    lineas: traslado.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      lote: item.lote,
      cantidadSolicitada: item.solicitudTrasladoItem ? Number(item.solicitudTrasladoItem.cantidad) : null,
      cantidadTrasladada: Number(item.cantidad),
      unidadMedida: item.unidadMedida,
    })),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Acta-${traslado.numero}.pdf"`,
    },
  });
}
