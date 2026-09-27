import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { MONEDAS } from "@/lib/constants/moneda";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const almacenId = searchParams.get("almacenId") ?? undefined;

  const [almacen, ingresos] = await Promise.all([
    almacenId ? prisma.almacen.findUnique({ where: { id: almacenId } }) : null,
    prisma.ingresoAlmacen.findMany({
      where: almacenId ? { almacenId } : undefined,
      include: { almacen: true, proveedor: true, items: { include: { sku: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  type Fila = {
    Número: string;
    Almacén: string;
    Fecha: string;
    "N° de OC": string;
    Moneda: string;
    "Guía de remisión": string;
    "RUC del remitente": string;
    "Nombre del remitente": string;
    Proveedor: string;
    Código: string;
    Producto: string;
    Lote: string;
    Cantidad: number;
    "U.M.": string;
    "Precio unitario": number;
    Subtotal: number;
    "Flete asignado": number;
    "Costo (US$)": number;
    Observaciones: string;
  };

  const filas: Fila[] = [];
  for (const ingreso of ingresos) {
    const monedaNombre = MONEDAS.find((m) => m.codigo === ingreso.moneda)?.nombre ?? ingreso.moneda;
    for (const item of ingreso.items) {
      filas.push({
        Número: ingreso.numero,
        Almacén: ingreso.almacen.nombre,
        Fecha: formatDate(ingreso.fecha),
        "N° de OC": ingreso.ocNumero ?? "",
        Moneda: monedaNombre,
        "Guía de remisión": ingreso.guiaRemision ?? "",
        "RUC del remitente": ingreso.remitenteRuc ?? "",
        "Nombre del remitente": ingreso.remitente ?? "",
        Proveedor: ingreso.proveedor?.razonSocial ?? "",
        Código: item.sku.codigo,
        Producto: item.sku.descripcion,
        Lote: item.lote ?? "",
        Cantidad: Number(item.cantidad),
        "U.M.": item.unidadMedida,
        "Precio unitario": Number(item.precioUnitario),
        Subtotal: Number(item.subtotal),
        "Flete asignado": Number(item.fleteAsignado),
        "Costo (US$)": Number(item.subtotalUsd) + Number(item.fleteAsignadoUsd),
        Observaciones: ingreso.observaciones ?? "",
      });
    }
  }

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 22 },
    { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 30 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Ingresos");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const sufijo = almacen ? `_${almacen.codigo}` : "";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ingresos-almacen${sufijo}.xlsx"`,
    },
  });
}
