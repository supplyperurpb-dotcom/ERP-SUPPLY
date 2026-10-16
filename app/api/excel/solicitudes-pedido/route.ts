import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { formatDate, fechaLocalHoy } from "@/lib/utils";
import { AREAS_EMPRESA, TIPOS_NECESIDAD, CATEGORIAS_COMPRA } from "@/lib/constants/compras";
import type { EstadoDocumento } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ANULADO: "Anulada",
};

const ESTADO_ITEM_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

function nombreArea(valor: string): string {
  return AREAS_EMPRESA.find((a) => a.valor === valor)?.nombre ?? valor;
}

export async function GET() {
  const solicitudes = await prisma.solicitudPedido.findMany({
    include: {
      items: {
        include: {
          sku: true,
          ordenCompraItems: { where: { ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type Fila = {
    "Número de solicitud": string;
    Categoría: string;
    Área: string;
    "Estado de la solicitud": string;
    "Fecha de pedido": string;
    "Fecha de necesidad": string;
    "Tipo de necesidad": string;
    Justificación: string;
    Código: string;
    Producto: string;
    "Descripción del servicio": string;
    "Cantidad solicitada": number;
    Unidad: string;
    "Cantidad con OC": number;
    "Cantidad pendiente": number;
    "Centro de costo": string;
    Campo: string;
    "Estado del producto": string;
  };

  const filas: Fila[] = [];

  for (const solicitud of solicitudes) {
    const datosComunes = {
      "Número de solicitud": solicitud.numero,
      Categoría: CATEGORIAS_COMPRA.find((c) => c.valor === solicitud.categoria)?.nombre ?? solicitud.categoria,
      Área: nombreArea(solicitud.area),
      "Estado de la solicitud": ESTADO_LABEL[solicitud.estado],
      "Fecha de pedido": formatDate(solicitud.fecha),
      "Fecha de necesidad": formatDate(solicitud.fechaNecesidad),
      "Tipo de necesidad": TIPOS_NECESIDAD.find((t) => t.valor === solicitud.tipoNecesidad)?.nombre ?? solicitud.tipoNecesidad,
      Justificación: solicitud.justificacion ?? "",
    };

    if (solicitud.items.length === 0) {
      filas.push({
        ...datosComunes,
        Código: "",
        Producto: "",
        "Descripción del servicio": "",
        "Cantidad solicitada": 0,
        Unidad: "",
        "Cantidad con OC": 0,
        "Cantidad pendiente": 0,
        "Centro de costo": "",
        Campo: "",
        "Estado del producto": "",
      });
      continue;
    }

    for (const item of solicitud.items) {
      const cantidad = Number(item.cantidad);
      const jalado = item.ordenCompraItems.reduce((acc, oci) => acc + Number(oci.cantidad), 0);
      const pendiente = item.estado === "RECHAZADO" ? 0 : Math.round((cantidad - jalado) * 1000) / 1000;
      filas.push({
        ...datosComunes,
        Código: item.sku.codigo,
        Producto: item.sku.descripcion,
        "Descripción del servicio": item.descripcion ?? "",
        "Cantidad solicitada": cantidad,
        Unidad: item.unidadMedida,
        "Cantidad con OC": jalado,
        "Cantidad pendiente": pendiente,
        "Centro de costo": nombreArea(item.centroCosto),
        Campo: item.campo ?? "",
        "Estado del producto": ESTADO_ITEM_LABEL[item.estado] ?? item.estado,
      });
    }
  }

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 18 }, // Número de solicitud
    { wch: 12 }, // Categoría
    { wch: 20 }, // Área
    { wch: 16 }, // Estado de la solicitud
    { wch: 14 }, // Fecha de pedido
    { wch: 14 }, // Fecha de necesidad
    { wch: 14 }, // Tipo de necesidad
    { wch: 30 }, // Justificación
    { wch: 14 }, // Código
    { wch: 30 }, // Producto
    { wch: 30 }, // Descripción del servicio
    { wch: 16 }, // Cantidad solicitada
    { wch: 10 }, // Unidad
    { wch: 14 }, // Cantidad con OC
    { wch: 16 }, // Cantidad pendiente
    { wch: 20 }, // Centro de costo
    { wch: 22 }, // Campo
    { wch: 16 }, // Estado del producto
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Solicitudes de pedido");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="solicitudes-de-pedido_${fechaLocalHoy()}.xlsx"`,
    },
  });
}
