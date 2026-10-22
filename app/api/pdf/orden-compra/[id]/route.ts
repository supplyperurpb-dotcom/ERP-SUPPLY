import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarOrdenCompraPdf } from "@/lib/pdf/orden-compra-pdf";
import { NOMBRE_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { codigoAprobador } from "@/lib/utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: { include: { sku: true, solicitudPedidoItem: { include: { solicitudPedido: true } } } },
    },
  });

  if (!orden) {
    return NextResponse.json({ error: "No se encontró la orden de compra." }, { status: 404 });
  }

  const idsUsuarios = new Set<string>();
  if (orden.creadoPorId) idsUsuarios.add(orden.creadoPorId);
  if (orden.aprobadoPorId) idsUsuarios.add(orden.aprobadoPorId);
  const idsSolicitantes = new Set(
    orden.items
      .map((item) => item.solicitudPedidoItem?.solicitudPedido.solicitanteId)
      .filter((v): v is string => !!v)
  );
  for (const id of idsSolicitantes) idsUsuarios.add(id);
  const idsAprobadoresSolped = new Set(
    orden.items
      .map((item) => item.solicitudPedidoItem?.solicitudPedido.aprobadoPorId)
      .filter((v): v is string => !!v)
  );
  for (const id of idsAprobadoresSolped) idsUsuarios.add(id);

  const usuarios = idsUsuarios.size > 0 ? await prisma.usuario.findMany({ where: { id: { in: [...idsUsuarios] } } }) : [];
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  // Toda la trazabilidad del pie (quién solicitó/aprobó/generó) usa el
  // mismo formato corto que aprobadoPorCodigo: inicial + apellido.
  const codigoUsuario = (id: string | null | undefined) => {
    const u = id ? usuarioPorId.get(id) : null;
    return u ? codigoAprobador(u.nombres, u.apellidos) : null;
  };

  const codigosSolicitantes = [...new Set([...idsSolicitantes].map((id) => codigoUsuario(id)).filter((n): n is string => !!n))];
  const codigosAprobadoresSolped = [
    ...new Set([...idsAprobadoresSolped].map((id) => codigoUsuario(id)).filter((n): n is string => !!n)),
  ];

  const direccionProveedor = [
    orden.proveedor.direccion,
    [orden.proveedor.distrito, orden.proveedor.provincia, orden.proveedor.departamento].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(" ");

  const bytes = await generarOrdenCompraPdf({
    nombreDocumento: NOMBRE_ORDEN[orden.categoria as CategoriaCompraCodigo],
    numero: orden.numero,
    fecha: orden.fecha,
    fechaEntrega: orden.fechaEntrega,
    condicionPago: orden.condicionPago,
    lugarEntrega: orden.lugarEntrega,
    observaciones: orden.observaciones,
    categoriaEsCompra: orden.categoria === "COMPRA",
    proveedor: orden.proveedor.razonSocial,
    rucProveedor: orden.proveedor.tipoDocumento === "RUC" ? orden.proveedor.numeroDocumento : "",
    direccionProveedor,
    emailProveedor: orden.proveedor.email ?? "",
    telefonoProveedor: orden.proveedor.telefono ?? "",
    moneda: orden.moneda,
    lineas: orden.items.map((item) => ({
      codigo: item.sku.codigo,
      descripcion: item.descripcion ? `${item.sku.descripcion} — ${item.descripcion}` : item.sku.descripcion,
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
    aprobado: orden.estado === "APROBADO",
    anulado: orden.estado === "ANULADO",
    aprobadoPorCodigo: codigoUsuario(orden.aprobadoPorId),
    usuarioSolped: codigosSolicitantes.length > 0 ? codigosSolicitantes.join(", ") : null,
    usuarioCreacion: codigoUsuario(orden.creadoPorId),
    solpedAprobadoPor: codigosAprobadoresSolped.length > 0 ? codigosAprobadoresSolped.join(", ") : null,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${orden.numero}.pdf"`,
    },
  });
}
