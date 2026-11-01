// Carga proveedores desde el Excel de la base de proveedores real (hoja
// "Sheet1", encabezados: PROCEDENCIA, CODIGO(RUC), RAZÓN SOCIAL, DIRECCION,
// EMAIL, TELEFONO, Contacto, C/Pago, Lugar, Nombre comercial, TIPO — ver
// Proveedor en prisma/schema.prisma, que agregó procedencia/lugar/rubro
// para que coincidan con estas columnas).
//
// Se corre a mano:
//   npx tsx --env-file=.env scripts/importar-proveedores.ts [ruta-al-excel]
//
// Es seguro volver a correrlo: un proveedor cuyo (tipoDocumento,
// numeroDocumento) ya existe se SALTA (nunca se sobreescribe un proveedor
// ya creado, sea de una corrida anterior de este script o hecho a mano).
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUTA_POR_DEFECTO = "C:\\Users\\josem\\Downloads\\Data de proveedores.xlsx";

// Algunas celdas traen "-" como placeholder de "vacío", comillas sueltas
// pegadas al valor (ej. "correo@x.com'") o saltos de línea en medio de un
// campo de una sola línea — se normaliza todo eso antes de guardar.
function limpiar(valor: unknown): string {
  let s = String(valor ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  s = s.replace(/^['"]+|['"]+$/g, "").trim();
  if (s === "-") return "";
  return s;
}

// La fuente no usa los mismos textos que CONDICIONES_PAGO (lib/constants/
// compras.ts) — ej. "CRÉDITO 30" en vez de "CREDITO 30 DIAS" — así que se
// normaliza por diccionario. Los valores nuevos que no existían (CONTADO,
// los ADELANTO X%, etc.) ya se agregaron a esa lista.
const MAPA_CONDICION_PAGO: Record<string, string> = {
  CONTADO: "CONTADO",
  "CRÉDITO 30": "CREDITO 30 DIAS",
  "CREDITO 30": "CREDITO 30 DIAS",
  "CRÉDITO 07": "CREDITO 7 DIAS",
  "CREDITO 07": "CREDITO 7 DIAS",
  "CREDITO 7 DIAS": "CREDITO 7 DIAS",
  "ADELANTO 50%": "ADELANTO 50%",
  "CRÉDITO 15": "CREDITO 15 DIAS",
  "CREDITO 15": "CREDITO 15 DIAS",
  "FN 60 DIAS": "FACTURA NEGOCIABLE 60 DIAS",
  "CRÉDITO 60": "CREDITO 60 DIAS",
  "CREDITO 60": "CREDITO 60 DIAS",
  "CRÉDITO 10": "CREDITO 10 DIAS",
  "CREDITO 10": "CREDITO 10 DIAS",
  "FACTURA NEGOCIABLE 120 DÍAS": "FACTURA NEGOCIABLE 120 DIAS",
  "FACTURA NEGOCIABLE 120 DIAS": "FACTURA NEGOCIABLE 120 DIAS",
  "FACTURA NEGOCIABLE 30 DÍAS": "FACTURA NEGOCIABLE 30 DIAS",
  "FACTURA NEGOCIABLE 30 DIAS": "FACTURA NEGOCIABLE 30 DIAS",
  "SEGÚN OBSER.": "SEGUN OBSERVACION",
  "ADELANTO 20%": "ADELANTO 20%",
  "ADELANTO 40%": "ADELANTO 40%",
  "ADELANTO 30%": "ADELANTO 30%",
  "CRÉDITO 90": "CREDITO 90 DIAS",
  "CREDITO 90": "CREDITO 90 DIAS",
  "FN 90 DIAS": "FACTURA NEGOCIABLE 90 DIAS",
  "FACTURA NEGOCIABLE 60 DIAS": "FACTURA NEGOCIABLE 60 DIAS",
  "CREDITO 75 DIAS": "CREDITO 75 DIAS",
};

function condicionPago(raw: string): string {
  const normalizado = MAPA_CONDICION_PAGO[raw.toUpperCase().trim()];
  if (normalizado) return normalizado;
  console.warn(`  [aviso] condición de pago desconocida "${raw}", se usa CONTADO por defecto`);
  return "CONTADO";
}

type FilaProveedor = {
  procedencia: "NACIONAL" | "EXTRANJERO";
  tipoDocumento: "RUC" | "DNI" | "EXTRANJERO";
  numeroDocumento: string;
  razonSocial: string;
  nombreComercial: string | null;
  tipo: "INSUMOS" | "TRANSPORTE";
  rubro: string | null;
  direccion: string | null;
  lugar: string | null;
  telefono: string | null;
  email: string | null;
  contactoNombre: string | null;
  condicionPago: string;
};

function procesarFila(fila: unknown[], numeroExcel: number): FilaProveedor | { error: string } {
  const procedenciaRaw = limpiar(fila[0]).toUpperCase();
  if (procedenciaRaw !== "NACIONAL" && procedenciaRaw !== "EXTRANJERO") {
    return { error: `fila ${numeroExcel}: PROCEDENCIA inválida "${fila[0]}"` };
  }
  const procedencia = procedenciaRaw as "NACIONAL" | "EXTRANJERO";

  const codigo = limpiar(fila[1]);
  const razonSocial = limpiar(fila[2]);
  if (!razonSocial) return { error: `fila ${numeroExcel}: sin razón social` };
  if (!codigo) return { error: `fila ${numeroExcel} (${razonSocial}): sin código` };

  let tipoDocumento: "RUC" | "DNI" | "EXTRANJERO";
  if (procedencia === "EXTRANJERO") {
    tipoDocumento = "EXTRANJERO";
  } else if (/^\d{11}$/.test(codigo)) {
    tipoDocumento = "RUC";
  } else if (/^\d{8}$/.test(codigo)) {
    tipoDocumento = "DNI";
  } else {
    return { error: `fila ${numeroExcel} (${razonSocial}): código nacional "${codigo}" no es RUC (11 dígitos) ni DNI (8 dígitos)` };
  }

  const rubro = limpiar(fila[10]);
  const tipo: "INSUMOS" | "TRANSPORTE" = /TRANSPORTE/i.test(rubro) ? "TRANSPORTE" : "INSUMOS";

  return {
    procedencia,
    tipoDocumento,
    numeroDocumento: codigo,
    razonSocial,
    nombreComercial: limpiar(fila[9]) || null,
    tipo,
    rubro: rubro || null,
    direccion: limpiar(fila[3]) || null,
    lugar: limpiar(fila[8]) || null,
    telefono: limpiar(fila[5]) || null,
    email: limpiar(fila[4]) || null,
    contactoNombre: limpiar(fila[6]) || null,
    condicionPago: condicionPago(limpiar(fila[7])),
  };
}

async function main() {
  const ruta = process.argv[2] ?? RUTA_POR_DEFECTO;
  console.log(`Leyendo ${ruta} ...`);
  const wb = XLSX.readFile(ruta);
  const ws = wb.Sheets["Sheet1"];
  if (!ws) throw new Error('No se encontró la hoja "Sheet1".');
  const filas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const datos = filas.slice(1).filter((f) => f.some((c) => String(c).trim() !== ""));
  console.log(`${datos.length} filas con datos.`);

  let creados = 0;
  let saltados = 0;
  const errores: string[] = [];

  for (let i = 0; i < datos.length; i++) {
    const numeroExcel = i + 2; // +1 por el encabezado, +1 por ser 1-indexado
    const resultado = procesarFila(datos[i], numeroExcel);
    if ("error" in resultado) {
      errores.push(resultado.error);
      continue;
    }

    const existente = await prisma.proveedor.findUnique({
      where: {
        tipoDocumento_numeroDocumento: {
          tipoDocumento: resultado.tipoDocumento,
          numeroDocumento: resultado.numeroDocumento,
        },
      },
      select: { id: true },
    });
    if (existente) {
      saltados++;
      continue;
    }

    await prisma.proveedor.create({ data: resultado });
    creados++;
  }

  console.log(`\nCreados: ${creados}`);
  console.log(`Ya existían (saltados): ${saltados}`);
  console.log(`Filas con error (no importadas): ${errores.length}`);
  for (const e of errores) console.log(`  - ${e}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
