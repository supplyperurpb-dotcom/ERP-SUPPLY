import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { calcularResumenLiquidaciones } from "@/lib/comex/resumen-liquidaciones";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const filas = await calcularResumenLiquidaciones({
    desde: desde ? new Date(desde) : undefined,
    hasta: hasta ? new Date(hasta) : undefined,
  });

  type Fila = {
    "Ship Number": string;
    PO: string;
    Pallet: string;
    LPN: string;
    Variedad: string;
    SKU: string;
    "Cajas despachadas": number;
    "Cajas buenas": number;
    "Cajas rechazadas (confirmadas)": number;
    "Terminal Market": number;
    "Non-Fresh": number;
    Donation: number;
    "Sin clasificar": number;
    "% Rechazo": string;
  };

  const datos: Fila[] = filas.map((f) => ({
    "Ship Number": f.shipNumber,
    PO: f.po ?? "",
    Pallet: f.palletNumber,
    LPN: f.lpn ?? "",
    Variedad: f.variedad,
    SKU: f.descripcionSku ?? "",
    "Cajas despachadas": f.cajasDespachadas,
    "Cajas buenas": f.cajasBuenas,
    "Cajas rechazadas (confirmadas)": f.cajasRechazadasConfirmadas,
    "Terminal Market": f.cajasTerminalMarket,
    "Non-Fresh": f.cajasNonFresh,
    Donation: f.cajasDonation,
    "Sin clasificar": f.cajasSinClasificar,
    "% Rechazo": `${f.pctRechazo.toFixed(1)}%`,
  }));

  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Resumen de Liquidaciones");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const sufijoFecha = desde || hasta ? `_${desde ?? "inicio"}_a_${hasta ?? "hoy"}` : "";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resumen-liquidaciones${sufijoFecha}.xlsx"`,
    },
  });
}
