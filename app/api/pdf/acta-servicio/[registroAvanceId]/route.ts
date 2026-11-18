import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generarActaServicioPdf, type LineaActaServicioPdf } from "@/lib/pdf/acta-servicio-pdf";
import { codigoAprobador } from "@/lib/utils";

// Solo se emite para un Registro de Avance ya totalmente APROBADO (todas
// sus líneas con VB) — ver el botón "Descargar Acta" en
// app/(dashboard)/logistica/gestion-servicios/[id]/registro/[numero]/page.tsx,
// que por eso solo aparece en ese estado.
export async function GET(_request: Request, { params }: { params: Promise<{ registroAvanceId: string }> }) {
  const { registroAvanceId } = await params;

  const registro = await prisma.registroAvance.findUnique({
    where: { id: registroAvanceId },
    include: {
      servicioGestionado: { include: { ordenCompra: { include: { proveedor: true } } } },
      items: { include: { ordenCompraItem: { include: { sku: true } }, avances: true } },
    },
  });

  if (!registro) {
    return NextResponse.json({ error: "Este registro de avance ya no existe." }, { status: 404 });
  }
  if (registro.estado !== "APROBADO") {
    return NextResponse.json({ error: "Esta Acta solo se emite cuando el registro ya está totalmente aprobado." }, { status: 400 });
  }

  const idsAprobadores = [...new Set(registro.items.map((i) => i.decididoPorId).filter((v): v is string => !!v))];
  const idsUsuarios = new Set(idsAprobadores);
  if (registro.creadoPorId) idsUsuarios.add(registro.creadoPorId);
  const usuarios = idsUsuarios.size ? await prisma.usuario.findMany({ where: { id: { in: [...idsUsuarios] } } }) : [];
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  const codigoUsuario = (id: string | null) => {
    const u = id ? usuarioPorId.get(id) : null;
    return u ? codigoAprobador(u.nombres, u.apellidos) : null;
  };
  const aprobadoPor = idsAprobadores.map((id) => codigoUsuario(id)).filter((v): v is string => !!v);
  const gestionadoPor = codigoUsuario(registro.creadoPorId);

  const lineas: LineaActaServicioPdf[] = registro.items.map((item) => {
    const cantidadAvanzada = item.avances.reduce((acc, a) => acc + Number(a.cantidad), 0);
    const valorizado = item.avances.reduce((acc, a) => acc + Number(a.valorizado), 0);
    return {
      codigo: item.ordenCompraItem.sku.codigo,
      descripcion: item.ordenCompraItem.descripcion || item.ordenCompraItem.sku.descripcion,
      unidadMedida: item.ordenCompraItem.sku.unidadMedida,
      cantidadAvanzada,
      precioUnitario: Number(item.ordenCompraItem.precioUnitario),
      valorizado,
    };
  });
  const montoTotal = lineas.reduce((acc, l) => acc + l.valorizado, 0);

  const orden = registro.servicioGestionado.ordenCompra;
  const bytes = await generarActaServicioPdf({
    numeroOrden: orden.numero,
    numeroRegistro: registro.numero,
    fechaDecision: registro.fechaDecision ?? new Date(),
    proveedor: orden.proveedor.razonSocial,
    rucProveedor: orden.proveedor.tipoDocumento === "RUC" ? orden.proveedor.numeroDocumento : "",
    moneda: orden.moneda,
    lineas,
    montoTotal,
    gestionadoPor,
    aprobadoPor,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Acta_${orden.numero}_Registro${registro.numero}.pdf"`,
    },
  });
}
