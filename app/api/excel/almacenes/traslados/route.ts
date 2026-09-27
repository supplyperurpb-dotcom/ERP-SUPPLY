import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { MONEDAS } from "@/lib/constants/moneda";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const almacenId = searchParams.get("almacenId") ?? undefined;

  const [almacen, traslados] = await Promise.all([
    almacenId ? prisma.almacen.findUnique({ where: { id: almacenId } }) : null,
    prisma.trasladoAlmacen.findMany({
      where: almacenId ? { OR: [{ almacenOrigenId: almacenId }, { almacenDestinoId: almacenId }] } : undefined,
      include: { almacenOrigen: true, almacenDestino: true, items: { include: { sku: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  type Fila = {
    Número: string;
    Fecha: string;
    Origen: string;
    Destino: string;
    Moneda: string;
    "Guía de remisión": string;
    "RUC del remitente": string;
    "Nombre del remitente": string;
    Código: string;
    Producto: string;
    Cantidad: number;
    "U.M.": string;
    "Costo unit. ponderado (US$)": number;
    "Valor (US$)": number;
    "Flete asignado": number;
    "Flete (US$)": number;
    Observaciones: string;
  };

  const filas: Fila[] = [];
  for (const traslado of traslados) {
    const monedaNombre = MONEDAS.find((m) => m.codigo === traslado.moneda)?.nombre ?? traslado.moneda;
    for (const item of traslado.items) {
      filas.push({
        Número: traslado.numero,
        Fecha: formatDate(traslado.fecha),
        Origen: traslado.almacenOrigen.nombre,
        Destino: traslado.almacenDestino.nombre,
        Moneda: monedaNombre,
        "Guía de remisión": traslado.guiaRemision ?? "",
        "RUC del remitente": traslado.remitenteRuc ?? "",
        "Nombre del remitente": traslado.remitente ?? "",
        Código: item.sku.codigo,
        Producto: item.sku.descripcion,
        Cantidad: Number(item.cantidad),
        "U.M.": item.unidadMedida,
        "Costo unit. ponderado (US$)": Number(item.costoUnitario),
        "Valor (US$)": Number(item.valorTotal),
        "Flete asignado": Number(item.fleteAsignado),
        "Flete (US$)": Number(item.fleteAsignadoUsd),
        Observaciones: traslado.observaciones ?? "",
      });
    }
  }

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 22 },
    { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Traslados");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const sufijo = almacen ? `_${almacen.codigo}` : "";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="traslados-almacen${sufijo}.xlsx"`,
    },
  });
}
