import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarOrdenCompraPdf } from "@/lib/pdf/orden-compra-pdf";
import { NOMBRE_ORDEN, TIPOS_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { codigoAprobador } from "@/lib/utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      items: { include: { sku: true, solicitudPedidoItem: { include: { solicitudPedido: true } } } },
      firmas: true,
    },
  });

  if (!orden) {
    return NextResponse.json({ error: "No se encontró la orden de compra." }, { status: 404 });
  }

  // Una OC/OS por monto puede requerir más de una firma (ver
  // rolesFirmaRequeridos en lib/compras.ts) — orden.aprobadoPorId solo
  // guarda quién puso la ÚLTIMA (ver firmarOrdenCompraAction), así que la
  // trazabilidad del pie usa cada firma ya APROBADA; si la orden no tuvo
  // firmas por monto (quedó aprobada directo), cae a aprobadoPorId solo.
  const idsFirmantesAprobados = [...new Set(orden.firmas.filter((f) => f.estado === "APROBADO").map((f) => f.usuarioId).filter((v): v is string => !!v))];
  const idsAprobadores = idsFirmantesAprobados.length > 0 ? idsFirmantesAprobados : orden.aprobadoPorId ? [orden.aprobadoPorId] : [];

  const idsUsuarios = new Set<string>();
  if (orden.creadoPorId) idsUsuarios.add(orden.creadoPorId);
  for (const id of idsAprobadores) idsUsuarios.add(id);
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
  // Pedido explícito: 2+ aprobadores de la OC/OS van uno al lado del otro
  // separados por " / " (no coma, para distinguirlo del resto de listas
  // de códigos de este pie que sí usan ", ").
  const codigosAprobadores = [...new Set(idsAprobadores.map((id) => codigoUsuario(id)).filter((n): n is string => !!n))];
  const codigosAprobadoresSolped = [
    ...new Set([...idsAprobadoresSolped].map((id) => codigoUsuario(id)).filter((n): n is string => !!n)),
  ];

  // Ubicación: pais (extranjero) o departamento/provincia/distrito
  // (nacional) es lo que llena el formulario hoy (ver Proveedor.pais);
  // `lugar` solo queda con datos en proveedores creados antes de ese
  // cambio, se usa como último recurso.
  const direccionProveedor = [
    orden.proveedor.direccion,
    orden.proveedor.pais ||
      [orden.proveedor.distrito, orden.proveedor.provincia, orden.proveedor.departamento].filter(Boolean).join(" - ") ||
      orden.proveedor.lugar,
  ]
    .filter(Boolean)
    .join(" ");

  const bytes = await generarOrdenCompraPdf({
    nombreDocumento: NOMBRE_ORDEN[orden.categoria as CategoriaCompraCodigo],
    numero: orden.numero,
    fecha: orden.fecha,
    tipoOrdenLabel: TIPOS_ORDEN.find((t) => t.valor === orden.tipoOrden)?.nombre ?? orden.tipoOrden,
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
    aprobadoPorCodigo: codigosAprobadores.length > 0 ? codigosAprobadores.join(" / ") : null,
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
