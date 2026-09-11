import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { formatDate, rangoFechaIngreso } from "@/lib/utils";
import type { EstadoDocumento } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  ANULADO: "Anulado",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;

  const fechaIngreso = rangoFechaIngreso(desde, hasta);

  const ingresos = await prisma.ingresoFruta.findMany({
    where: fechaIngreso ? { fechaIngreso } : undefined,
    include: {
      proveedor: true,
      pallets: {
        include: { tipoBandeja: true, tipoPallet: true, pallet: true },
        orderBy: { numeroPallet: "asc" },
      },
    },
    orderBy: { fechaIngreso: "desc" },
  });

  type Fila = {
    "Número de ingreso": string;
    "Proveedor / Fundo": string;
    "Doc. proveedor": string;
    Placa: string;
    "Fecha de cosecha": string;
    "Fecha de ingreso": string;
    "Hora de ingreso": string;
    Estado: string;
    "Módulo": string;
    Turno: string;
    Variedad: string;
    "Tipo de bandeja": string;
    "Tipo de pallet": string;
    "Cantidad de bandejas": number;
    "Peso bruto (kg)": number;
    "Tara (kg)": number;
    "Peso neto (kg)": number;
    "Pallet asignado": string;
    Observaciones: string;
  };

  const filas: Fila[] = [];

  for (const ingreso of ingresos) {
    const docProveedor = `${ingreso.proveedor.tipoDocumento} ${ingreso.proveedor.numeroDocumento}`;
    if (ingreso.pallets.length === 0) {
      filas.push({
        "Número de ingreso": ingreso.numero,
        "Proveedor / Fundo": ingreso.proveedor.razonSocial,
        "Doc. proveedor": docProveedor,
        Placa: ingreso.placaTransporte ?? "",
        "Fecha de cosecha": formatDate(ingreso.fechaCosecha),
        "Fecha de ingreso": formatDate(ingreso.fechaIngreso, { timeZone: "America/Lima" }),
        "Hora de ingreso": ingreso.horaIngreso ?? "",
        Estado: ESTADO_LABEL[ingreso.estado],
        "Módulo": "",
        Turno: "",
        Variedad: "",
        "Tipo de bandeja": "",
        "Tipo de pallet": "",
        "Cantidad de bandejas": 0,
        "Peso bruto (kg)": 0,
        "Tara (kg)": 0,
        "Peso neto (kg)": 0,
        "Pallet asignado": "",
        Observaciones: ingreso.observaciones ?? "",
      });
      continue;
    }

    for (const linea of ingreso.pallets) {
      filas.push({
        "Número de ingreso": ingreso.numero,
        "Proveedor / Fundo": ingreso.proveedor.razonSocial,
        "Doc. proveedor": docProveedor,
        Placa: ingreso.placaTransporte ?? "",
        "Fecha de cosecha": formatDate(ingreso.fechaCosecha),
        "Fecha de ingreso": formatDate(ingreso.fechaIngreso, { timeZone: "America/Lima" }),
        "Hora de ingreso": ingreso.horaIngreso ?? "",
        Estado: ESTADO_LABEL[ingreso.estado],
        "Módulo": linea.modulo,
        Turno: linea.turno,
        Variedad: linea.variedad,
        "Tipo de bandeja": linea.tipoBandeja.nombre,
        "Tipo de pallet": linea.tipoPallet?.nombre ?? "",
        "Cantidad de bandejas": linea.cantidadBandejas,
        "Peso bruto (kg)": Number(linea.pesoBrutoTotalKg),
        "Tara (kg)": Number(linea.pesoTaraTotalKg),
        "Peso neto (kg)": Number(linea.pesoNetoKg),
        "Pallet asignado": linea.pallet.numero,
        Observaciones: ingreso.observaciones ?? "",
      });
    }
  }

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 16 }, // Número de ingreso
    { wch: 28 }, // Proveedor / Fundo
    { wch: 16 }, // Doc. proveedor
    { wch: 10 }, // Placa
    { wch: 14 }, // Fecha de cosecha
    { wch: 14 }, // Fecha de ingreso
    { wch: 12 }, // Hora de ingreso
    { wch: 12 }, // Estado
    { wch: 12 }, // Módulo
    { wch: 10 }, // Turno
    { wch: 12 }, // Variedad
    { wch: 20 }, // Tipo de bandeja
    { wch: 20 }, // Tipo de pallet
    { wch: 12 }, // Cantidad de bandejas
    { wch: 14 }, // Peso bruto
    { wch: 12 }, // Tara
    { wch: 14 }, // Peso neto
    { wch: 14 }, // Pallet asignado
    { wch: 30 }, // Observaciones
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Ingresos");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const sufijoFecha = desde || hasta ? `_${desde ?? "inicio"}_a_${hasta ?? "hoy"}` : "";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ingresos-materia-prima${sufijoFecha}.xlsx"`,
    },
  });
}
