import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { DocumentoPruebaPdf } from "@/lib/pdf/documento-base";

// Ruta de prueba para validar el pipeline de generación de PDF en entorno
// serverless (Vercel). En fases siguientes cada módulo (Tarja, Guía de
// Remisión, Packing List) tendrá su propio route handler con datos reales.
export const runtime = "nodejs";

const DOCUMENTOS_DEMO: Record<string, { titulo: string; numero: string; filas: { label: string; value: string }[] }> = {
  guia: {
    titulo: "Guía de Remisión (remitente) — prueba",
    numero: "T001-00000001",
    filas: [
      { label: "Motivo de traslado", value: "Traslado entre establecimientos" },
      { label: "Punto de partida", value: "Fundo Los Arándanos, Ica" },
      { label: "Punto de llegada", value: "Planta de proceso, Ica" },
      { label: "Peso bruto total", value: "1,250.500 kg" },
      { label: "Transportista", value: "Transportes Demo S.A.C. — RUC 20000000001" },
      { label: "Placa del vehículo", value: "ABC-123" },
    ],
  },
  tarja: {
    titulo: "Tarja de pallet — prueba",
    numero: "TJ-0001",
    filas: [
      { label: "Lote", value: "L-2026-0001" },
      { label: "Proveedor / Fundo", value: "Fundo Los Arándanos" },
      { label: "Variedad", value: "Biloxi" },
      { label: "N.º de bandejas", value: "120" },
      { label: "Peso bruto", value: "265.800 kg" },
      { label: "Peso neto", value: "240.900 kg" },
    ],
  },
  "packing-list": {
    titulo: "Packing List — prueba",
    numero: "PL-0001",
    filas: [
      { label: "Embarque / Contenedor", value: "EMB-0001 / MSCU1234567" },
      { label: "Formato", value: "Clamshell 125g" },
      { label: "N.º de cajas", value: "1,800" },
      { label: "Peso neto", value: "6,750.000 kg" },
      { label: "Peso bruto", value: "7,200.000 kg" },
    ],
  },
};

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "guia";
  const documento = DOCUMENTOS_DEMO[tipo] ?? DOCUMENTOS_DEMO.guia;

  // @react-pdf/renderer tipa renderToBuffer para aceptar únicamente un
  // elemento <Document> directo, no un componente que internamente renderiza
  // uno. En runtime es válido (DocumentoPruebaPdf renderiza un <Document> en
  // su raíz); el cast solo alinea el tipo con la firma de la librería.
  const elemento = createElement(DocumentoPruebaPdf, {
    titulo: documento.titulo,
    numero: documento.numero,
    filas: documento.filas,
  }) as unknown as Parameters<typeof renderToBuffer>[0];

  const buffer = await renderToBuffer(elemento);

  // Node's Buffer doesn't structurally satisfy the DOM BodyInit typing in
  // all TS/lib versions; a plain Uint8Array view over it does.
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${tipo}-prueba.pdf"`,
    },
  });
}
