import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { fechaLocalHoy } from "@/lib/utils";

export async function GET() {
  const skus = await prisma.sku.findMany({ orderBy: { codigo: "asc" } });

  type Fila = {
    Código: string;
    Descripción: string;
    Categoría: string;
    Subfamilia: string;
    Unidad: string;
    "Stock mínimo": number | string;
    Estado: string;
  };

  const filas: Fila[] = skus.map((sku) => ({
    Código: sku.codigo,
    Descripción: sku.descripcion,
    Categoría: sku.categoria,
    Subfamilia: sku.subfamilia,
    Unidad: sku.unidadMedida,
    "Stock mínimo": sku.stockMinimo !== null ? Number(sku.stockMinimo) : "",
    Estado: sku.activo ? "Activo" : "Inactivo",
  }));

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 16 }, // Código
    { wch: 45 }, // Descripción
    { wch: 32 }, // Categoría
    { wch: 22 }, // Subfamilia
    { wch: 10 }, // Unidad
    { wch: 12 }, // Stock mínimo
    { wch: 10 }, // Estado
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "SKU");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sku_${fechaLocalHoy()}.xlsx"`,
    },
  });
}
