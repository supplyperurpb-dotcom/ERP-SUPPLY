import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarOrdenCompraPdf } from "@/lib/pdf/orden-compra-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { proveedor: true, items: { include: { sku: true } } },
  });

  if (!orden) {
    return NextResponse.json({ error: "No se encontró la orden de compra." }, { status: 404 });
  }

  const bytes = await generarOrdenCompraPdf({
    numero: orden.numero,
    fecha: orden.fecha,
    proveedor: orden.proveedor.razonSocial,
    rucProveedor: orden.proveedor.tipoDocumento === "RUC" ? orden.proveedor.numeroDocumento : "",
    moneda: orden.moneda,
    lineas: orden.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.sku.descripcion,
      cantidad: Number(item.cantidad),
      unidadMedida: item.sku.unidadMedida,
      precioUnitario: Number(item.precioUnitario),
      gravado: item.gravado,
      subtotal: Number(item.subtotal),
      centroCosto: item.centroCosto,
    })),
    subtotal: Number(orden.subtotal),
    igv: Number(orden.igv),
    montoTotal: Number(orden.montoTotal),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${orden.numero}.pdf"`,
    },
  });
}
