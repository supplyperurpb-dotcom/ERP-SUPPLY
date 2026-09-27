import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const almacenId = searchParams.get("almacenId") ?? undefined;

  const [almacen, consumos] = await Promise.all([
    almacenId ? prisma.almacen.findUnique({ where: { id: almacenId } }) : null,
    prisma.consumoAlmacen.findMany({
      where: almacenId ? { almacenOrigenId: almacenId } : undefined,
      include: { almacen: true, items: { include: { sku: true } } },
      orderBy: { fecha: "desc" },
    }),
  ]);

  type Fila = {
    Número: string;
    Fecha: string;
    Almacén: string;
    Código: string;
    Producto: string;
    Cantidad: number;
    "U.M.": string;
    "Precio unit. ponderado (US$)": number;
    "Valor consumido (US$)": number;
    Observaciones: string;
  };

  const filas: Fila[] = [];
  for (const consumo of consumos) {
    for (const item of consumo.items) {
      filas.push({
        Número: consumo.numero,
        Fecha: formatDate(consumo.fecha),
        Almacén: consumo.almacen.nombre,
        Código: item.sku.codigo,
        Producto: item.sku.descripcion,
        Cantidad: Number(item.cantidad),
        "U.M.": item.unidadMedida,
        "Precio unit. ponderado (US$)": Number(item.precioUnitarioPonderado),
        "Valor consumido (US$)": Number(item.valorConsumido),
        Observaciones: consumo.observaciones ?? "",
      });
    }
  }

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 18 },
    { wch: 16 }, { wch: 30 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Consumos");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const sufijo = almacen ? `_${almacen.codigo}` : "";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="consumos-almacen${sufijo}.xlsx"`,
    },
  });
}
