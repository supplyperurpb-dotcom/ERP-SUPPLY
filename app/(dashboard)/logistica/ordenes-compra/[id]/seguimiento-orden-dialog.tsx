"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResumenSolpedDialog, type ResumenSolped } from "@/components/shared/resumen-solped-dialog";

export type ItemSeguimientoOrden = {
  id: string;
  codigo: string;
  descripcion: string;
  descripcionServicio: string | null;
  unidadMedida: string;
  cantidad: number;
  solicitud: { id: string; numero: string } | null;
  guiasRemision: string[];
  cantidadRecibida: number;
};

export function SeguimientoOrdenDialog({
  numero,
  fecha,
  responsable,
  fechaCreacion,
  fechaAprobacion,
  aprobadoPor,
  esServicio,
  items,
  resumenesSolpeds,
}: {
  numero: string;
  fecha: string;
  responsable: string;
  fechaCreacion: string;
  fechaAprobacion: string | null;
  aprobadoPor: string | null;
  esServicio: boolean;
  items: ItemSeguimientoOrden[];
  resumenesSolpeds: Record<string, ResumenSolped>;
}) {
  const [open, setOpen] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState<ResumenSolped | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Truck className="mr-2 h-4 w-4" />
        Seguimiento del pedido
      </Button>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seguimiento de {numero}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-muted-foreground">N° de OC/OS</p>
            <p className="font-medium">{numero}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha del documento</p>
            <p className="font-medium">{fecha}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Responsable</p>
            <p className="font-medium">{responsable}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de creación</p>
            <p className="font-medium">{fechaCreacion}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de aprobación</p>
            <p className="font-medium">{fechaAprobacion ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Aprobado por</p>
            <p className="font-medium">{aprobadoPor ?? "—"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                {esServicio && <TableHead>Descripción del servicio</TableHead>}
                <TableHead>U.M.</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>N° de solicitud</TableHead>
                <TableHead>Guía de remisión</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.codigo}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  {esServicio && (
                    <TableCell className="max-w-xs whitespace-pre-wrap">{item.descripcionServicio || "—"}</TableCell>
                  )}
                  <TableCell>{item.unidadMedida}</TableCell>
                  <TableCell className="text-right">{item.cantidad}</TableCell>
                  <TableCell>
                    {item.solicitud ? (
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => setResumenAbierto(resumenesSolpeds[item.solicitud!.id] ?? null)}
                      >
                        {item.solicitud.numero}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{item.guiasRemision.length > 0 ? item.guiasRemision.join(", ") : "—"}</TableCell>
                  <TableCell className="text-right">{item.cantidadRecibida}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      <ResumenSolpedDialog resumen={resumenAbierto} onClose={() => setResumenAbierto(null)} />
    </Dialog>
  );
}
