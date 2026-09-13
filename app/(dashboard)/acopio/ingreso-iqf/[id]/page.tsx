import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatDateTime, formatKg } from "@/lib/utils";
import type { EstadoDocumento, EstadoPallet } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  ANULADO: "Anulado",
};

const ESTADO_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

const ESTADO_PALLET_LABEL: Record<EstadoPallet, string> = {
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

export default async function DetalleIngresoIQFPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ingreso = await prisma.ingresoIQF.findUnique({
    where: { id },
    include: {
      proveedor: true,
      pallets: {
        include: { tipoBandeja: true, tipoPallet: true, pallet: true },
        orderBy: { numeroPallet: "asc" },
      },
    },
  });

  if (!ingreso) {
    notFound();
  }

  const totalBandejas = ingreso.pallets.reduce((acc, p) => acc + p.cantidadBandejas, 0);
  const totalBruto = ingreso.pallets.reduce((acc, p) => acc + Number(p.pesoBrutoTotalKg), 0);
  const totalTara = ingreso.pallets.reduce((acc, p) => acc + Number(p.pesoTaraTotalKg), 0);
  const totalNeto = ingreso.pallets.reduce((acc, p) => acc + Number(p.pesoNetoKg), 0);

  return (
    <div>
      <Link
        href="/acopio/ingreso-iqf"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Ingreso IQF
      </Link>

      <PageHeader
        titulo={`Ingreso ${ingreso.numero}`}
        descripcion="Detalle del camión y sus líneas de pesaje de descarte de planta."
        acciones={
          <div className="flex items-center gap-2">
            <Badge variant={ESTADO_VARIANT[ingreso.estado]}>{ESTADO_LABEL[ingreso.estado]}</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/acopio/ingreso-iqf/${ingreso.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Datos del camión</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="Fundo" valor={ingreso.proveedor.razonSocial} />
          <Dato label="Placa del vehículo" valor={ingreso.placaTransporte ?? "—"} />
          <Dato label="Hora de recepción" valor={ingreso.horaIngreso ?? "—"} />
          <Dato label="Fecha de cosecha" valor={formatDate(ingreso.fechaCosecha)} />
          <Dato label="Fecha de ingreso" valor={formatDateTime(ingreso.fechaIngreso)} />
          <Dato label="Observaciones" valor={ingreso.observaciones ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Líneas de pesaje ({ingreso.pallets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ingreso.pallets.length === 0 ? (
            <p className="flex items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Boxes className="h-4 w-4" /> Este ingreso no tiene líneas de pesaje.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variedad</TableHead>
                    <TableHead>Tipo de producto</TableHead>
                    <TableHead>Tipo de bandeja</TableHead>
                    <TableHead>Tipo de pallet</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Peso bruto</TableHead>
                    <TableHead>Tara</TableHead>
                    <TableHead>Peso neto</TableHead>
                    <TableHead>Pallet asignado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingreso.pallets.map((linea) => (
                    <TableRow key={linea.id}>
                      <TableCell>{linea.variedad}</TableCell>
                      <TableCell>{linea.tipoProducto}</TableCell>
                      <TableCell>{linea.tipoBandeja.nombre}</TableCell>
                      <TableCell>{linea.tipoPallet?.nombre ?? "—"}</TableCell>
                      <TableCell>{linea.cantidadBandejas}</TableCell>
                      <TableCell>{formatKg(Number(linea.pesoBrutoTotalKg))}</TableCell>
                      <TableCell>{formatKg(Number(linea.pesoTaraTotalKg))}</TableCell>
                      <TableCell className="font-medium">{formatKg(Number(linea.pesoNetoKg))}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{linea.pallet.numero}</span>
                          <Badge variant={linea.pallet.estado === "CERRADO" ? "success" : "secondary"}>
                            {ESTADO_PALLET_LABEL[linea.pallet.estado]}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-wrap justify-end gap-6 border-t pt-4 text-sm">
                <p>
                  Total bandejas: <span className="font-medium">{totalBandejas}</span>
                </p>
                <p>
                  Peso bruto: <span className="font-medium">{formatKg(totalBruto)}</span>
                </p>
                <p>
                  Tara: <span className="font-medium">{formatKg(totalTara)}</span>
                </p>
                <p>
                  Peso neto: <span className="font-semibold text-primary">{formatKg(totalNeto)}</span>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <Button variant="outline" asChild>
          <Link href="/acopio/tarjas-iqf">Ir a Tarjas IQF para generar la etiqueta del pallet</Link>
        </Button>
      </div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
