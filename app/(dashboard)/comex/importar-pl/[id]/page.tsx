import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatCantidad } from "@/lib/utils";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";

export default async function DetalleImportacionPLPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const embarqueDb = await prisma.embarque.findUnique({
    where: { id },
    include: { pallets: { orderBy: { palletNumber: "asc" } } },
  });
  if (!embarqueDb || !embarqueDb.shipNumber) notFound();

  const embarque = embarqueDb;
  const pallets = embarqueDb.pallets.map((p) => ({ ...p, cases: p.cases, pesoNetoKg: Number(p.pesoNetoKg) }));
  const urlArchivo = embarque.archivoOriginalUrl ? await obtenerUrlFirmadaArchivo(embarque.archivoOriginalUrl, 300) : null;

  const totalCases = pallets.reduce((acc, p) => acc + p.cases, 0);
  const totalNetWeight = pallets.reduce((acc, p) => acc + p.pesoNetoKg, 0);

  return (
    <div>
      <Link href="/comex/importar-pl" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Volver a Importar PL
      </Link>
      <PageHeader
        titulo={`Embarque ${embarque.numero}`}
        descripcion={`Ship Number ${embarque.shipNumber}${embarque.importadoEn ? ` · Importado el ${formatDate(embarque.importadoEn)}` : ""}`}
        acciones={
          urlArchivo && (
            <Button variant="outline" asChild>
              <a href={urlArchivo} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Descargar Excel original
              </a>
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Datos del embarque</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Dato etiqueta="Grower" valor={embarque.grower} />
          <Dato etiqueta="Consignee" valor={embarque.consignee} />
          <Dato etiqueta="Notify" valor={embarque.notify} />
          <Dato etiqueta="Naviera" valor={embarque.naviera} />
          <Dato etiqueta="Nave" valor={embarque.vessel} />
          <Dato etiqueta="Contenedor" valor={embarque.contenedor} />
          <Dato etiqueta="BL/SWB" valor={embarque.blSwb} />
          <Dato etiqueta="Tipo de embarque" valor={embarque.tipoEmbarque} />
          <Dato etiqueta="Puerto de carga" valor={embarque.origenPuerto} />
          <Dato etiqueta="Puerto de descarga" valor={embarque.destinoPuerto} />
          <Dato etiqueta="Fecha de carga" valor={embarque.fechaCarga ? formatDate(embarque.fechaCarga) : null} />
          <Dato etiqueta="ETD" valor={embarque.etd ? formatDate(embarque.etd) : null} />
          <Dato etiqueta="ETA" valor={embarque.eta ? formatDate(embarque.eta) : null} />
          <Dato etiqueta="Total Cases" valor={formatCantidad(totalCases)} />
          <Dato etiqueta="Total Net Weight" valor={formatCantidad(totalNetWeight)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pallets ({pallets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Pallet</TableHead>
                  <TableHead>Variedad</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Tipo fruta</TableHead>
                  <TableHead numeric>Cases</TableHead>
                  <TableHead numeric>Net Weight</TableHead>
                  <TableHead>Cosecha</TableHead>
                  <TableHead>LPN</TableHead>
                  <TableHead>Trazabilidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pallets.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.palletNumber}</TableCell>
                    <TableCell>{p.variedad}</TableCell>
                    <TableCell>{p.descripcionSku ?? "—"}</TableCell>
                    <TableCell>{p.label ?? "—"}</TableCell>
                    <TableCell>{p.fruitType ?? "—"}</TableCell>
                    <TableCell numeric>{formatCantidad(p.cases)}</TableCell>
                    <TableCell numeric>{formatCantidad(p.pesoNetoKg)}</TableCell>
                    <TableCell>{p.fechaCosecha ? formatDate(p.fechaCosecha) : "—"}</TableCell>
                    <TableCell className="font-mono">{p.lpnDriscolls ?? "—"}</TableCell>
                    <TableCell className="font-mono">{p.trazabilityCodeDoc ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="font-medium">{valor || "—"}</p>
    </div>
  );
}
