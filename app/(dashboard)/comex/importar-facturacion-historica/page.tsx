import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatCantidad } from "@/lib/utils";

export default async function ImportarFacturacionHistoricaPage() {
  const importaciones = await prisma.importHistory.findMany({
    where: { tipo: "FACTURACION_HISTORICA" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        titulo="Importar Facturación"
        descripcion="Migración histórica de la hoja Facturación (Excel) a Supabase, con las 130 columnas originales. Es una migración única: no se vuelve a importar el mismo archivo, y repetirla con otro archivo requiere confirmación administrativa."
        acciones={
          <Button asChild>
            <Link href="/comex/importar-facturacion-historica/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva importación
            </Link>
          </Button>
        }
      />

      {importaciones.length === 0 ? (
        <EmptyState
          icono={FileSpreadsheet}
          titulo="Aún no hay ninguna migración histórica"
          descripcion="Importa el Excel de Facturación con el botón de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Archivo</TableHead>
              <TableHead numeric>Registros</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ejecutado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {importaciones.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.archivoNombre}</TableCell>
                <TableCell numeric>{formatCantidad(i.registros)}</TableCell>
                <TableCell>
                  <Badge variant={i.estado === "COMPLETADO" ? "success" : "destructive"}>{i.estado}</Badge>
                </TableCell>
                <TableCell>{formatDate(i.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
