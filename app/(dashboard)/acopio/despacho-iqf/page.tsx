import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatKg } from "@/lib/utils";

export default async function DespachoIQFPage() {
  const despachos = await prisma.despachoIQF.findMany({
    include: { tarjas: { include: { pallet: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        titulo="Despacho IQF"
        descripcion="Registro de pallets IQF despachados (con tarja generada) hacia su siguiente destino: placa del camión, conductor y fecha/hora de salida. Independiente del Despacho de Ingreso de Materia Prima."
        acciones={
          <Button asChild>
            <Link href="/acopio/despacho-iqf/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo despacho IQF
            </Link>
          </Button>
        }
      />

      {despachos.length === 0 ? (
        <EmptyState
          icono={Truck}
          titulo="Aún no hay despachos IQF registrados"
          descripcion="Registra el primer despacho con el botón de arriba."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Conductor</TableHead>
              <TableHead>Fecha de despacho</TableHead>
              <TableHead>N.º de tarjas</TableHead>
              <TableHead>Total bandejas</TableHead>
              <TableHead>Peso neto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {despachos.map((d) => {
              const totalBandejas = d.tarjas.reduce((acc, t) => acc + t.pallet.cantidadBandejas, 0);
              const totalNeto = d.tarjas.reduce((acc, t) => acc + Number(t.pallet.pesoNetoKg), 0);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.numero}</TableCell>
                  <TableCell>{d.placaCamion}</TableCell>
                  <TableCell>{d.conductor}</TableCell>
                  <TableCell>
                    {formatDate(d.fechaDespacho)}
                    {d.horaDespacho ? ` ${d.horaDespacho}` : ""}
                  </TableCell>
                  <TableCell>{d.tarjas.length}</TableCell>
                  <TableCell>{totalBandejas}</TableCell>
                  <TableCell>{formatKg(totalNeto)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
