import Link from "next/link";
import { PackageX, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import type { EstadoRechazoCorreo } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoRechazoCorreo, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
};

const ESTADO_VARIANT: Record<EstadoRechazoCorreo, "success" | "destructive" | "secondary"> = {
  PENDIENTE: "secondary",
  CONFIRMADO: "success",
  ANULADO: "destructive",
};

export default async function RegistroRechazosPage() {
  const correos = await prisma.rechazoCorreo.findMany({
    include: { embarque: { select: { numero: true, shipNumber: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        titulo="Registro de Rechazos"
        descripcion="Sube la captura de un correo de rechazo de cliente: se lee por OCR, se cruza por LPN con los Packing List ya importados y queda registrado."
        acciones={
          <Button asChild>
            <Link href="/comex/registro-rechazos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nueva importación
            </Link>
          </Button>
        }
      />

      {correos.length === 0 ? (
        <EmptyState
          icono={PackageX}
          titulo="Aún no hay correos de rechazo registrados"
          descripcion="Importa el primero con el botón de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asunto</TableHead>
              <TableHead>Embarque</TableHead>
              <TableHead>Remitente</TableHead>
              <TableHead>Fecha del correo</TableHead>
              <TableHead numeric>Líneas</TableHead>
              <TableHead numeric>Cajas (correo)</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {correos.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/comex/registro-rechazos/${c.id}`} className="text-primary hover:underline">
                    {c.asuntoCorreo ?? "(sin asunto)"}
                  </Link>
                </TableCell>
                <TableCell>{c.embarque ? `${c.embarque.numero} (${c.embarque.shipNumber})` : "—"}</TableCell>
                <TableCell>{c.remitente ?? "—"}</TableCell>
                <TableCell>{c.fechaCorreo ? formatDate(c.fechaCorreo) : "—"}</TableCell>
                <TableCell numeric>{c._count.items}</TableCell>
                <TableCell numeric>{c.totalCajasRechazadasCorreo ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
