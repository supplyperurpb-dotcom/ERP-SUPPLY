import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default async function GuiasRemisionPage() {
  const guias = await prisma.guiaRemision.findMany({
    include: { ingresoFruta: { include: { proveedor: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Guías de remisión"
        descripcion="Guías de remisión (remitente/transportista) generadas a partir de los ingresos de fruta. El modelo de datos sigue la estructura que exige SUNAT para poder integrarse con un OSE/PSE en una fase posterior, sin necesidad de rediseño."
        acciones={
          <Button variant="outline" asChild>
            <a href="/api/pdf/test?tipo=guia" target="_blank" rel="noopener noreferrer">
              <FileText className="mr-2 h-4 w-4" />
              Generar PDF de prueba
            </a>
          </Button>
        }
      />

      {guias.length === 0 ? (
        <EmptyState
          icono={FileText}
          titulo="Aún no hay guías de remisión"
          descripcion="Las guías se generarán a partir de un ingreso de fruta registrado en Acopio. Por ahora puedes previsualizar el formato de PDF interno con el botón de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serie-número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Proveedor / Fundo</TableHead>
              <TableHead>Fecha de traslado</TableHead>
              <TableHead>Peso bruto total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guias.map((guia) => (
              <TableRow key={guia.id}>
                <TableCell className="font-medium">{guia.serie}-{guia.numero}</TableCell>
                <TableCell>{guia.tipoGuia === "REMITENTE" ? "Remitente" : "Transportista"}</TableCell>
                <TableCell>{guia.ingresoFruta.proveedor.razonSocial}</TableCell>
                <TableCell>{formatDate(guia.fechaTraslado)}</TableCell>
                <TableCell>{guia.pesoBrutoTotalKg.toString()} kg</TableCell>
                <TableCell>
                  <Badge variant={guia.estado === "EMITIDA" ? "success" : "secondary"}>
                    {guia.estado === "EMITIDA" ? "Emitida" : "Anulada"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
