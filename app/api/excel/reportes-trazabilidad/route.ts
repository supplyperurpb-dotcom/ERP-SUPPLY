import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { calcularTrazabilidad, ESTADO_ATENCION_LABEL, type EstadoAtencionLinea } from "@/lib/trazabilidad";
import { fechaLocalHoy, formatDate } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { lineas } = await calcularTrazabilidad({
    creacionDesde: searchParams.get("creacionDesde") ?? undefined,
    creacionHasta: searchParams.get("creacionHasta") ?? undefined,
    aprobacionDesde: searchParams.get("aprobacionDesde") ?? undefined,
    aprobacionHasta: searchParams.get("aprobacionHasta") ?? undefined,
    familia: searchParams.get("familia") ?? undefined,
    subfamilia: searchParams.get("subfamilia") ?? undefined,
    codigo: searchParams.get("codigo") ?? undefined,
    requerimiento: searchParams.get("requerimiento") ?? undefined,
    ordenCompra: searchParams.get("ordenCompra") ?? undefined,
    proveedor: searchParams.get("proveedor") ?? undefined,
    estadoAtencion: (searchParams.get("estadoAtencion") as EstadoAtencionLinea | null) ?? undefined,
  });

  type Fila = {
    "N° de requerimiento": string;
    "Fecha de creación": string;
    "Fecha de aprobación": string;
    "Código de artículo": string;
    Descripción: string;
    Familia: string;
    Subfamilia: string;
    "Cantidad solicitada": number;
    "Cantidad asociada a OC": number | string;
    "Cantidad atendida": number | string;
    "Cantidad pendiente con orden": number;
    "Cantidad pendiente sin orden": number;
    "N° de orden de compra": string;
    "Fecha de emisión OC": string;
    Proveedor: string;
    "Estado de la orden": string;
    "Fecha de recepción": string;
    "Cantidad recibida": number | string;
    "Estado de atención": string;
  };

  const filas: Fila[] = [];
  for (const linea of lineas) {
    const base = {
      "N° de requerimiento": linea.requerimientoNumero,
      "Fecha de creación": formatDate(linea.fechaCreacion),
      "Fecha de aprobación": linea.fechaAprobacion ? formatDate(linea.fechaAprobacion) : "",
      "Código de artículo": linea.codigo,
      Descripción: linea.descripcion,
      Familia: linea.familia,
      Subfamilia: linea.subfamilia,
      "Cantidad solicitada": linea.cantidadSolicitada,
      "Cantidad pendiente con orden": linea.cantidadPendienteConOrden,
      "Cantidad pendiente sin orden": linea.cantidadPendienteSinOrden,
      "Estado de atención": ESTADO_ATENCION_LABEL[linea.estado],
    };

    if (linea.ordenes.length === 0) {
      filas.push({
        ...base,
        "Cantidad asociada a OC": "",
        "Cantidad atendida": "",
        "N° de orden de compra": "",
        "Fecha de emisión OC": "",
        Proveedor: "",
        "Estado de la orden": "",
        "Fecha de recepción": "",
        "Cantidad recibida": "",
      });
      continue;
    }

    for (const orden of linea.ordenes) {
      const baseOrden = {
        ...base,
        "Cantidad asociada a OC": orden.cantidadOrdenada,
        "Cantidad atendida": orden.cantidadAtendida,
        "N° de orden de compra": orden.ocNumero,
        "Fecha de emisión OC": formatDate(orden.ocFecha),
        Proveedor: orden.proveedorNombre,
        "Estado de la orden": orden.ocEstado,
      };
      if (orden.recepciones.length === 0) {
        filas.push({ ...baseOrden, "Fecha de recepción": "", "Cantidad recibida": "" });
        continue;
      }
      for (const recepcion of orden.recepciones) {
        filas.push({ ...baseOrden, "Fecha de recepción": formatDate(recepcion.fecha), "Cantidad recibida": recepcion.cantidad });
      }
    }
  }

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Trazabilidad");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trazabilidad_${fechaLocalHoy()}.xlsx"`,
    },
  });
}
