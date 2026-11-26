import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { calcularReporteStock } from "@/lib/stock-almacen";
import { fechaLocalHoy, formatDate } from "@/lib/utils";

export async function GET() {
  const filas = await calcularReporteStock();

  type Fila = {
    Código: string;
    Producto: string;
    Almacén: string;
    Lote: string;
    "Fecha de Producción": string;
    "Fecha de Vencimiento": string;
    Cantidad: number;
    UM: string;
    "Precio Ponderado (USD)": number;
    "Valorizado (USD)": number;
  };

  const datos: Fila[] = filas.map((f) => ({
    Código: f.codigo,
    Producto: f.descripcion,
    Almacén: f.almacenNombre,
    Lote: f.lote ?? "",
    "Fecha de Producción": f.fechaProduccion ? formatDate(f.fechaProduccion) : "",
    "Fecha de Vencimiento": f.fechaVencimiento ? formatDate(f.fechaVencimiento) : "",
    Cantidad: f.cantidad,
    UM: f.unidadMedida,
    "Precio Ponderado (USD)": f.precioUnitarioPonderado ?? 0,
    "Valorizado (USD)": f.valorizado ?? 0,
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 26 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 8 },
    { wch: 18 },
    { wch: 16 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Stock");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventario-stock_${fechaLocalHoy()}.xlsx"`,
    },
  });
}
